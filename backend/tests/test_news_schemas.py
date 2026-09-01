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


if __name__ == "__main__":
    unittest.main()
