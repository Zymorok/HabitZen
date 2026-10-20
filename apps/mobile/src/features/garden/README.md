# garden

Дерево 1–10, рост по выполненным делам и награда за полный день (кадры 10–11, HZ-06). Не принимает доверенные очки от интерфейса: уровень выводится из подтверждённых отметок на сервере.

- `data/` — `garden_state` и `claim_day_reward`.
- `stage.ts` — какой рисунок у уровня и какие карточки показывать (tests/unit/garden.test.ts).
- `tree-art.ts` — 7 рисунков стадий на общем холсте, `assets/garden`.
- `screens/GardenScreen.tsx` — кадр 10, `screens/CelebrationScreen.tsx` — кадр 11.
