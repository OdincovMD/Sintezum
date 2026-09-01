import os
import unittest
from types import SimpleNamespace

from sqlalchemy import text

from app import models
from app.database import Base, async_engine, async_session_factory
from app.news.repository import NewsConflictError, NewsForbiddenError, NewsRepository
from app.news.schemas import NewsCreate, NewsUpdate


@unittest.skipUnless(os.getenv("RUN_NEWS_DB_TESTS") == "1", "requires isolated PostgreSQL database")
class NewsRepositoryIntegrationTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.content = {
            "type": "doc",
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Текст новости"}]}],
        }

    async def asyncSetUp(self):
        async with async_engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_session_factory() as session:
            await session.execute(text(
                "TRUNCATE TABLE news, laboratories_organizations, organizations, users, roles "
                "RESTART IDENTITY CASCADE"
            ))
            await session.commit()
            lab_admin_role = models.Role(name="lab_admin")
            lab_rep_role = models.Role(name="lab_representative")
            platform_role = models.Role(name="platform_admin")
            session.add_all([lab_admin_role, lab_rep_role, platform_role])
            await session.flush()
            organization = models.Organization(name="Тестовая организация", is_published=True)
            session.add(organization)
            await session.flush()
            lab = models.OrganizationLaboratory(
                name="Тестовая лаборатория",
                organization_id=organization.id,
                is_published=True,
            )
            session.add(lab)
            await session.flush()
            employee = models.Employee(
                organization_id=organization.id,
                full_name="Анна Смирнова",
                position=["Научный сотрудник"],
            )
            other_organization = models.Organization(name="Другая организация", is_published=True)
            session.add_all([employee, other_organization])
            await session.flush()
            foreign_employee = models.Employee(
                organization_id=other_organization.id,
                full_name="Чужой сотрудник",
            )
            session.add(foreign_employee)
            await session.flush()
            await session.execute(
                models.employee_laboratories.insert().values(
                    employee_id=employee.id,
                    laboratory_id=lab.id,
                )
            )
            lab_admin = models.User(
                mail="news-admin@example.test",
                role_id=lab_admin_role.id,
                organization_id=organization.id,
            )
            lab_rep = models.User(mail="news-rep@example.test", role_id=lab_rep_role.id)
            platform_admin = models.User(mail="news-platform@example.test", role_id=platform_role.id)
            session.add_all([lab_admin, lab_rep, platform_admin])
            await session.flush()
            lab.creator_user_id = lab_rep.id
            await session.commit()
            self.organization_id = organization.id
            self.laboratory_id = lab.id
            self.employee_id = employee.id
            self.foreign_employee_id = foreign_employee.id
            self.lab_admin = SimpleNamespace(
                id=lab_admin.id,
                organization_id=organization.id,
                role=SimpleNamespace(name="lab_admin"),
            )
            self.lab_rep = SimpleNamespace(
                id=lab_rep.id,
                organization_id=None,
                role=SimpleNamespace(name="lab_representative"),
            )
            self.platform_admin = SimpleNamespace(
                id=platform_admin.id,
                organization_id=None,
                role=SimpleNamespace(name="platform_admin"),
            )

    async def asyncTearDown(self):
        await async_engine.dispose()

    async def test_publish_block_restore_and_owner_visibility(self):
        created = await NewsRepository.create(
            self.lab_admin,
            NewsCreate(
                scope="organization",
                organization_id=self.organization_id,
                title="Открытие центра",
                content=self.content,
                employee_ids=[self.employee_id],
            ),
        )
        self.assertEqual(created["employees"][0]["full_name"], "Анна Смирнова")
        published = await NewsRepository.set_published(created["id"], self.lab_admin, True)
        original_date = published["published_at"]
        items, total = await NewsRepository.list_public(page=1, size=12)
        self.assertEqual(total, 1)
        self.assertEqual(items[0]["title"], "Открытие центра")

        blocked = await NewsRepository.set_published(
            created["id"], self.platform_admin, False, admin=True
        )
        self.assertEqual(blocked["status"], "blocked")
        with self.assertRaises(NewsConflictError):
            await NewsRepository.set_published(created["id"], self.lab_admin, True)

        edited = await NewsRepository.update(
            created["id"],
            self.platform_admin,
            NewsUpdate(title="Исправленный заголовок"),
            admin=True,
        )
        self.assertEqual(edited["status"], "blocked")
        restored = await NewsRepository.set_published(
            created["id"], self.platform_admin, True, admin=True
        )
        self.assertEqual(restored["published_at"], original_date)

        async with async_session_factory() as session:
            organization = await session.get(models.Organization, self.organization_id)
            organization.is_published = False
            await session.commit()
        _, hidden_total = await NewsRepository.list_public(page=1, size=12)
        self.assertEqual(hidden_total, 0)

    async def test_employee_links_follow_news_owner(self):
        created = await NewsRepository.create(
            self.lab_rep,
            NewsCreate(
                scope="laboratory",
                laboratory_id=self.laboratory_id,
                title="Команда лаборатории",
                content=self.content,
                employee_ids=[self.employee_id, self.employee_id],
            ),
        )
        self.assertEqual([employee["id"] for employee in created["employees"]], [self.employee_id])

        available = await NewsRepository.list_eligible_employees(
            self.lab_rep,
            scope="laboratory",
            laboratory_id=self.laboratory_id,
        )
        self.assertEqual([employee["id"] for employee in available], [self.employee_id])

        async with async_session_factory() as session:
            await session.execute(
                models.employee_laboratories.delete().where(
                    models.employee_laboratories.c.employee_id == self.employee_id,
                    models.employee_laboratories.c.laboratory_id == self.laboratory_id,
                )
            )
            await session.commit()
        preserved = await NewsRepository.update(
            created["id"],
            self.lab_rep,
            NewsUpdate(title="Обновлённая новость", employee_ids=[self.employee_id]),
        )
        self.assertEqual([employee["id"] for employee in preserved["employees"]], [self.employee_id])

        with self.assertRaises(NewsConflictError):
            await NewsRepository.update(
                created["id"],
                self.lab_rep,
                NewsUpdate(employee_ids=[self.foreign_employee_id]),
            )

        cleared = await NewsRepository.update(
            created["id"],
            self.lab_rep,
            NewsUpdate(employee_ids=[]),
        )
        self.assertEqual(cleared["employees"], [])

    async def test_rejects_foreign_target(self):
        with self.assertRaises(NewsForbiddenError):
            await NewsRepository.create(
                self.lab_rep,
                NewsCreate(
                    scope="organization",
                    organization_id=self.organization_id,
                    title="Чужая новость",
                    content=self.content,
                ),
            )


if __name__ == "__main__":
    unittest.main()
