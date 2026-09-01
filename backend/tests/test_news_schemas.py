import unittest

from pydantic import ValidationError

from app.news.schemas import NewsCreate, NewsUpdate


class NewsEmployeeSchemaTests(unittest.TestCase):
    content = {"type": "doc", "content": []}

    def test_employee_ids_are_deduplicated(self):
        payload = NewsCreate(
            scope="organization",
            organization_id=1,
            title="Новость",
            content=self.content,
            employee_ids=[3, 3, 2],
        )
        self.assertEqual(payload.employee_ids, [3, 2])

    def test_rejects_invalid_or_excessive_employee_ids(self):
        with self.assertRaises(ValidationError):
            NewsUpdate(employee_ids=[0])
        with self.assertRaises(ValidationError):
            NewsUpdate(employee_ids=list(range(1, 22)))

    def test_accepts_gallery_attachments_and_source_change(self):
        payload = NewsUpdate(
            scope="laboratory",
            organization_id=None,
            laboratory_id=7,
            gallery_urls=["http://localhost:9000/labportal/news/1/photo.jpg"],
            attachments=[{
                "url": "http://localhost:9000/labportal/news/1/report.pdf",
                "name": "Отчёт.pdf",
                "size": 1024,
                "content_type": "application/pdf",
            }],
        )
        self.assertEqual(payload.laboratory_id, 7)
        self.assertEqual(payload.attachments[0].name, "Отчёт.pdf")

    def test_rejects_partial_source_and_external_files(self):
        with self.assertRaises(ValidationError):
            NewsUpdate(scope="laboratory")
        with self.assertRaises(ValidationError):
            NewsUpdate(organization_id=1)
        with self.assertRaises(ValidationError):
            NewsUpdate(attachments=[{
                "url": "https://example.org/report.pdf",
                "name": "report.pdf",
                "size": 1024,
                "content_type": "application/pdf",
            }])


if __name__ == "__main__":
    unittest.main()
