"""Validate a locally built Astro RSS feed using Python's standard library.

Usage:
    python scripts/verify-rss.py
    python scripts/verify-rss.py --expect-title "New article title"
"""

from __future__ import annotations

import argparse
from datetime import datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

SITE = "https://iceneoning-blog.pages.dev/"
CONTENT_TAG = "{http://purl.org/rss/1.0/modules/content/}encoded"


def is_absolute_web_url(value: str) -> bool:
    result = urlsplit(value)
    return result.scheme in {"http", "https"} and bool(result.netloc)


class BodyURLChecker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.issues: list[str] = []
        self.image_count = 0
        self.link_count = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "img":
            self.image_count += 1
            src = values.get("src")
            if not src or not is_absolute_web_url(src):
                self.issues.append(f"img src is missing or not absolute: {src!r}")
        elif tag == "a":
            self.link_count += 1
            href = values.get("href")
            if not href:
                continue_check = False
            else:
                scheme = urlsplit(href).scheme
                continue_check = is_absolute_web_url(href) or scheme in {"mailto", "tel"}
            if not continue_check:
                self.issues.append(f"a href is missing or not allowed: {href!r}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify dist/rss.xml after pnpm run build")
    parser.add_argument("--file", default="dist/rss.xml")
    parser.add_argument("--expect-title", action="append", default=[])
    args = parser.parse_args()

    path = Path(args.file)
    if not path.is_file():
        print(f"FAIL: RSS file not found: {path}")
        return 1

    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as error:
        print(f"FAIL: invalid XML: {error}")
        return 1

    problems: list[str] = []
    if root.tag != "rss" or root.attrib.get("version") != "2.0":
        problems.append("root is not RSS 2.0")

    channel = root.find("channel")
    if channel is None:
        print("FAIL: missing channel")
        return 1

    if channel.findtext("link") != SITE:
        problems.append("channel site URL does not match configured production site")

    items = channel.findall("item")
    if not items:
        problems.append("RSS contains no item")

    guids: set[str] = set()
    published_dates: list[datetime] = []
    titles: set[str] = set()
    image_count = 0
    link_count = 0
    for index, item in enumerate(items, start=1):
        item_label = f"item {index}"
        title = item.findtext("title")
        titles.add(title or "")
        link = item.findtext("link") or ""
        guid = item.findtext("guid") or ""
        if not title:
            problems.append(f"{item_label}: missing title")
        if not is_absolute_web_url(link):
            problems.append(f"{item_label}: invalid absolute permalink {link!r}")
        if not guid or guid in guids:
            problems.append(f"{item_label}: missing/duplicate GUID {guid!r}")
        guids.add(guid)

        published = item.findtext("pubDate")
        try:
            if not published:
                raise ValueError("missing date")
            date = parsedate_to_datetime(published)
            if date.tzinfo is None:
                raise ValueError("date has no timezone")
            published_dates.append(date)
        except (ValueError, TypeError) as error:
            problems.append(f"{item_label}: invalid pubDate {published!r}: {error}")

        body = item.findtext(CONTENT_TAG)
        if body is None:
            problems.append(f"{item_label}: missing full text content:encoded")
            continue

        checker = BodyURLChecker()
        checker.feed(body)
        image_count += checker.image_count
        link_count += checker.link_count
        problems.extend(f"{item_label}: {issue}" for issue in checker.issues)

    if published_dates != sorted(published_dates, reverse=True):
        problems.append("items are not ordered by descending pubDate")

    for expected in args.expect_title:
        if expected not in titles:
            problems.append(f"expected title absent: {expected!r}")

    print(f"RSS: {path} | items={len(items)} | images={image_count} | links={link_count}")
    if problems:
        for problem in problems:
            print(f"FAIL: {problem}")
        return 1
    print("PASS: RSS XML, metadata, full content, URL safety and ordering")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
