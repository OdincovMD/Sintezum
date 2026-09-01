import unittest

from app.news.validation import content_to_plain_text, first_image_url, validate_news_content


class NewsContentValidationTests(unittest.TestCase):
    def test_accepts_supported_formatting(self):
        content = {
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "text": "Новая лаборатория",
                    "marks": [
                        {"type": "bold"},
                        {"type": "link", "attrs": {"href": "https://example.org"}},
                    ],
                }],
            }],
        }
        cleaned = validate_news_content(content)
        self.assertEqual(content_to_plain_text(cleaned), "Новая лаборатория")
        self.assertEqual(cleaned["content"][0]["content"][0]["marks"][1]["attrs"]["target"], "_blank")

    def test_rejects_script_links(self):
        with self.assertRaisesRegex(ValueError, "Недопустимая ссылка"):
            validate_news_content({
                "type": "doc",
                "content": [{
                    "type": "paragraph",
                    "content": [{
                        "type": "text",
                        "text": "Опасная ссылка",
                        "marks": [{"type": "link", "attrs": {"href": "javascript:alert(1)"}}],
                    }],
                }],
            })

    def test_rejects_external_images(self):
        with self.assertRaisesRegex(ValueError, "хранилище платформы"):
            validate_news_content({
                "type": "doc",
                "content": [{"type": "image", "attrs": {"src": "https://example.org/tracker.png"}}],
            })

    def test_finds_first_platform_image(self):
        content = validate_news_content({
            "type": "doc",
            "content": [{
                "type": "image",
                "attrs": {"src": "http://localhost:9000/labportal/org/1/news/image.png"},
            }],
        })
        self.assertEqual(first_image_url(content), "http://localhost:9000/labportal/org/1/news/image.png")

    def test_rejects_unsupported_nodes_and_heading_levels(self):
        with self.assertRaises(ValueError):
            validate_news_content({"type": "doc", "content": [{"type": "script"}]})
        with self.assertRaisesRegex(ValueError, "второго и третьего"):
            validate_news_content({
                "type": "doc",
                "content": [{"type": "heading", "attrs": {"level": 1}, "content": []}],
            })

    def test_rejects_content_larger_than_one_megabyte(self):
        with self.assertRaisesRegex(ValueError, "1 МБ"):
            validate_news_content({
                "type": "doc",
                "content": [{
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "x" * (1024 * 1024)}],
                }],
            })


if __name__ == "__main__":
    unittest.main()
