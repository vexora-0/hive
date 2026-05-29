# Load Tests

k6 suite for the Hive API. Chosen over Artillery or JMeter because it is a
single binary with no runtime to install, scripts are plain JS, and it exits
non-zero when a threshold fails, so it drops into CI unchanged.

## Install

```bash
# macOS
brew install k6
# Debian/Ubuntu
sudo gpg -k && sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list && sudo apt update && sudo apt install k6
```

## Environment

```bash
export API_URL=https://hive-backend.onrender.com   # the deployed instance, not localhost
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=<anon-key>

export PARENT_EMAIL=parent.rajesh@bloom.demo
export TEACHER_EMAIL=teacher.sarita@bloom.demo
export ADMIN_EMAIL=admin@your-domain.com
export DEMO_PASSWORD=<demo-password>
export ADMIN_PASSWORD=<admin-password>

# Any photo and class ID from the seeded dataset
export SAMPLE_PHOTO_ID=<uuid>
export SAMPLE_CLASS_ID=<uuid>
```

Requires the demo seed (Plan 06). Run against the **deployed** instance —
localhost measures your laptop, not the deployment.

## Profiles

| File | Shape | Question it answers |
|---|---|---|
| `smoke.js` | 1 VU, 30 s | Does it work at all? Run first. |
| `load.js` | 50 VU, 5 min | Does it hold at expected peak? |
| `stress.js` | ramp to 300 VU | Where does it break? |
| `spike.js` | 10 → 200 → 10 | Does it recover from a burst? |

```bash
k6 run smoke.js
k6 run load.js
```

## Traffic weighting

`load.js` weights requests by realistic shape rather than hitting every
endpoint equally:

| Weight | Scenario |
|---|---|
| 60% | Parent feed + paginate |
| 20% | Photo detail |
| 10% | Teacher class photos |
| 10% | Admin dashboard |

Order creation is excluded from `load.js` — it writes rows, and a five-minute
run would leave thousands of junk orders in the demo database. Exercise it in
`smoke.js` against a scratch project instead.

## The number that matters

`feed_payload_bytes` tracks the transfer size of one 20-photo feed page.

Before Plan 03 no thumbnails were generated — `thumbnail_s3_key` was always
null, so the client fell back to full-resolution originals and a single page
could exceed 100 MB. The threshold is set at **2 MB p95**.

Record before and after in `docs/performance.md`. That comparison is the most
persuasive performance evidence in the project, and it costs one extra run.

## Interpreting results

The backend is deployed on a free tier. Expect the **host** to bind before the
application does — that is a legitimate finding, not a failed test. Report it
as "constrained by the free-tier host at N concurrent users; the identified
application-level bottleneck is X" rather than implying an unconstrained
result.

Cold starts: a free instance sleeps after ~15 minutes idle and takes 30–60 s
to wake. Hit `/health` before starting a run or the first requests will skew
every percentile.
