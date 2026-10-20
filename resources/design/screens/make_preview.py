"""Анимированное превью для README из видео-прохождения (HZ-07).

Берёт storage/reports/video/habitzen-web-demo.webm (`npm run demo:video`) и пишет
docs/media/habitzen-demo.webp — анимированный WebP: он легче GIF и показывается прямо в README.
Плюс контрольный лист кадров storage/reports/video/contact-sheet.png.

Запуск из корня проекта:  py resources/design/screens/make_preview.py
"""

from pathlib import Path

import cv2
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
VIDEO = ROOT / 'storage' / 'reports' / 'video' / 'habitzen-web-demo.webm'
OUT = ROOT / 'docs' / 'media' / 'habitzen-demo.webp'
WIDTH = 270
STEP = 3  # NOTE: 25 кадров/с → около 8 кадров/с: движение читается, файл остаётся лёгким.


def main():
    capture = cv2.VideoCapture(str(VIDEO))
    fps = capture.get(cv2.CAP_PROP_FPS) or 25
    frames = []
    index = 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        # NOTE: Пустые белые кадры загрузки страницы в начале пропускаем.
        if not frames and frame.mean() > 250:
            index += 1
            continue
        if index % STEP == 0:
            image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            frames.append(image.resize((WIDTH, round(image.height * WIDTH / image.width)), Image.LANCZOS))
        index += 1
    if not frames:
        raise SystemExit('Нет кадров — сначала npm run demo:video')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    duration = round(1000 * STEP / fps)
    frames[0].save(OUT, 'WEBP', save_all=True, append_images=frames[1:], duration=duration,
                   loop=0, quality=62, method=6)
    print(f'{OUT.relative_to(ROOT)}: {len(frames)} кадров, {OUT.stat().st_size // 1024} КБ')

    sheet_frames = frames[:: max(1, len(frames) // 12)][:12]
    sheet = Image.new('RGB', (WIDTH * 6 + 70, sheet_frames[0].height * 2 + 30), (240, 238, 230))
    for number, frame in enumerate(sheet_frames):
        row, column = divmod(number, 6)
        sheet.paste(frame, (10 + column * (WIDTH + 10), 10 + row * (frame.height + 10)))
    sheet.save(VIDEO.parent / 'contact-sheet.png')


if __name__ == '__main__':
    main()
