"""Подготовка цветных значков привычек из сырых картинок (HZ-10).

Обнуляет почти прозрачные пиксели (альфа < 10), обрезает по содержимому, ставит в квадрат
с полями 8 % и сохраняет 144×144 webp — как прежние значки assets/habits.
Запуск: py prepare_habit_icons.py <папка сырых> <папка assets/habits> имя1 имя2 ...
"""
import sys
from pathlib import Path

from PIL import Image

SIZE = 144
MARGIN = 0.08


def prepare(source: Path, target: Path) -> None:
    image = Image.open(source).convert('RGBA')
    alpha = image.getchannel('A').point(lambda value: 0 if value < 10 else value)
    image.putalpha(alpha)
    box = alpha.getbbox()
    if box is None:
        raise SystemExit(f'Пустая картинка: {source}')
    image = image.crop(box)
    side = max(image.size)
    canvas_side = round(side / (1 - 2 * MARGIN))
    canvas = Image.new('RGBA', (canvas_side, canvas_side), (0, 0, 0, 0))
    canvas.paste(image, ((canvas_side - image.width) // 2, (canvas_side - image.height) // 2))
    canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    canvas.save(target, 'WEBP', quality=90, method=6)


def main() -> None:
    raw = Path(sys.argv[1])
    out = Path(sys.argv[2])
    for name in sys.argv[3:]:
        prepare(raw / f'icon_{name}.png', out / f'{name}.webp')
        print(f'{name}: ok')


if __name__ == '__main__':
    main()
