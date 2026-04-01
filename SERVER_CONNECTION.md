# RankPapa — Подключение к серверу

## Параметры сервера
- **Host:** `69.197.178.118`
- **User:** `administrator`
- **Port:** `4822`
- **Auth:** Только SSH-ключи (пароль отключён)

## Подключение
```bash
ssh -p 4822 administrator@69.197.178.118
```

## Структура на сервере
- **Проект:** `/home/administrator/rankpapa`
- **Центральный Nginx:** `/home/administrator/labai/nginx/nginx.prod.conf`
- **SSL сертификаты:** `/home/administrator/labai/certbot/conf/live/`
- **Документация сервера:** `/home/administrator/SERVER_GUIDE.md`

## Доступ к приложению
- **URL:** `http://69.197.178.118:3010`
- Без домена, напрямую IP:порт
- Web-контейнер (`rankpapa-web`) слушает порт `3010`

## Docker контейнеры
| Контейнер | Описание |
|-----------|----------|
| `rankpapa-api` | Fastify API (внутренний порт 3000) |
| `rankpapa-worker` | BullMQ Worker + Playwright (браузерная автоматизация) |
| `rankpapa-web` | Vue3 + Nginx (внешний порт 3010) |
| `rankpapa-postgres` | PostgreSQL 16 |
| `rankpapa-redis` | Redis 7 |

## Деплой
- **Автоматический:** Push в `main` → GitHub Actions → SSH на сервер → docker compose up
- **Ручной:**
```bash
ssh -p 4822 administrator@69.197.178.118
cd /home/administrator/rankpapa
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy --schema=prisma/schema.prisma
```

## GitHub Actions секреты
Настраиваются на: https://github.com/NurlanOmarov/rankpapa/settings/secrets/actions

| Секрет | Значение |
|--------|----------|
| `SERVER_HOST` | `69.197.178.118` |
| `SERVER_USER` | `administrator` |
| `SSH_PORT` | `4822` |
| `SSH_PRIVATE_KEY` | Содержимое `~/.ssh/id_ed25519` (локально: `cat ~/.ssh/id_ed25519`) |

## ENV_PRODUCTION — значения для продакшна
```env
POSTGRES_USER=rankpapa
POSTGRES_PASSWORD=<придумай сильный пароль>
POSTGRES_DB=rankpapa
REDIS_URL=redis://redis:6379
JWT_SECRET=<длинная случайная строка>
JWT_EXPIRES_IN=7d
API_PORT=3000
API_HOST=0.0.0.0
VITE_API_URL=
PROSOX_API_KEY=4foqlZXBlXpKeZUK
PROSOX_PACKAGE_KEY=c27970d0808a7f824117
PROSOX_LOGIN=EEf2aX00glbxEvoMzPvA
PROSOX_PASSWORD=zVaXETNoAlKRakNrod8nB8qycn5OXr25
PROSOX_HOST=res.prosox.io
PROSOX_PORT_COUNT=50
FINGERPRINT_LOCALE=ru-KZ
FINGERPRINT_TIMEZONE=Asia/Almaty
WORKER_CONCURRENCY=5
WORKER_MAX_VISITS_PER_PROXY=10
PROFILES_DIR=/tmp/rp-profiles
```

## Nginx (центральный)
Конфиг: `/home/administrator/labai/nginx/nginx.prod.conf`

RankPapa работает напрямую на порту 3010, **без добавления в центральный nginx** (нет домена).

Если в будущем добавишь домен — добавить секцию в nginx.prod.conf и перезапустить:
```bash
docker exec labai-nginx-1 nginx -t
docker exec labai-nginx-1 nginx -s reload
```

## Логи
```bash
# API
docker logs --tail 50 rankpapa-api

# Worker
docker logs --tail 50 rankpapa-worker

# Web (nginx)
docker logs --tail 50 rankpapa-web

# Все контейнеры — ресурсы
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'
```

## Управление
```bash
# Остановить
docker compose -f docker-compose.prod.yml down

# Перезапустить один контейнер
docker compose -f docker-compose.prod.yml restart worker

# Посмотреть статус
docker compose -f docker-compose.prod.yml ps

# Миграции вручную
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy --schema=prisma/schema.prisma
```

---
*Обновлено 01.04.2026*
