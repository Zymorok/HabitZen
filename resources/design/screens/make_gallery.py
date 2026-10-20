"""Галерея экранов HabitZen для README (HZ-07).

Берёт снимки `npm run screens` (storage/reports/screens/{light,dark}/NN-*.png) и собирает:
  docs/screens/{light,dark}/NN-*.webp  — каждый кадр 390×844 для README;
  docs/screens/overview-{light,dark}.webp — все 12 кадров двумя рядами, как на макете;
  docs/screens/mockup-vs-app-1.webp и -2.webp — макет сверху, приложение снизу.

Запуск из корня проекта:  py resources/design/screens/make_gallery.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'storage' / 'reports' / 'screens'
OUT = ROOT / 'docs' / 'screens'
MOCKUP = ROOT / 'resources' / 'design' / 'reference.png'
# NOTE: Рамки 12 кадров на коллаже макета: два ряда по шесть телефонов.
FRAME_X = [40, 288, 536, 784, 1032, 1281]
FRAME_Y = [82, 548]
FRAME_SIZE = (216, 418)
BACKGROUND = (240, 238, 230)


def frames(scheme):
    return sorted((SOURCE / scheme).glob('[0-1][0-9]-*.png'))


def fit(image, height):
    return image.resize((round(image.width * height / image.height), height), Image.LANCZOS)


def save_webp(image, path, quality=82):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, 'WEBP', quality=quality, method=6)
    print(f'{path.relative_to(ROOT)}: {path.stat().st_size // 1024} КБ')


def grid(images, columns, height, gap=14):
    tiles = [fit(image, height) for image in images]
    width = max(tile.width for tile in tiles)
    rows = (len(tiles) + columns - 1) // columns
    sheet = Image.new('RGB', (columns * width + (columns + 1) * gap, rows * height + (rows + 1) * gap), BACKGROUND)
    for index, tile in enumerate(tiles):
        row, column = divmod(index, columns)
        sheet.paste(tile, (gap + column * (width + gap) + (width - tile.width) // 2, gap + row * (height + gap)))
    return sheet


def mockup_frames():
    collage = Image.open(MOCKUP).convert('RGB')
    width, height = FRAME_SIZE
    return [collage.crop((x, y, x + width, y + height)) for y in FRAME_Y for x in FRAME_X]


def main():
    for scheme in ('light', 'dark'):
        shots = frames(scheme)
        if len(shots) != 12:
            raise SystemExit(f'{scheme}: нужно 12 снимков, найдено {len(shots)} — сначала npm run screens')
        images = [Image.open(path).convert('RGB') for path in shots]
        for path, image in zip(shots, images):
            save_webp(image.resize((390, 844), Image.LANCZOS), OUT / scheme / f'{path.stem}.webp')
        save_webp(grid(images, 6, 520), OUT / f'overview-{scheme}.webp', quality=80)

    app = [Image.open(path).convert('RGB') for path in frames('light')]
    mockup = mockup_frames()
    for part, chunk in enumerate((slice(0, 6), slice(6, 12)), start=1):
        save_webp(grid(mockup[chunk] + app[chunk], 6, 520), OUT / f'mockup-vs-app-{part}.webp', quality=80)


if __name__ == '__main__':
    main()
