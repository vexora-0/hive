import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../src/app';
import { supabaseTest } from './setup';
import {
  createTestUser,
  createTestSchool,
  createTestClass,
  createTestStudent,
  createTestPhoto,
  linkParent,
  tagStudent,
  setPhotoReady,
  cleanupUsers,
  bearer,
  type TestUser,
} from './helpers';
import { PRODUCT_PRICES_CENTS } from '../src/constants/products';

/**
 * The order lifecycle, end to end.
 *
 * Plan 08 specified this file and it was never written, so the endpoint that
 * G-01 was about — the one that could not accept a single order — had no
 * automated coverage at all. It now also covers the fulfilment half, which had
 * no endpoints until this change: an order was created `pending` and nothing
 * could ever move it.
 */
describe('orders', () => {
  let school: string, otherSchool: string, classId: string;
  let teacher: TestUser, parent: TestUser, otherParent: TestUser;
  let admin: TestUser, otherAdmin: TestUser, platformAdmin: TestUser;
  let otherSchoolParent: TestUser;
  let child: string, otherChild: string;
  let photoId: string, otherPhotoId: string;

  beforeAll(async () => {
    school = await createTestSchool('Order School');
    otherSchool = await createTestSchool('Rival School');
    classId = await createTestClass(school);
    const otherClass = await createTestClass(otherSchool);

    teacher = await createTestUser('teacher', school);
    parent = await createTestUser('parent', school);
    otherParent = await createTestUser('parent', school);
    admin = await createTestUser('admin', school);
    otherAdmin = await createTestUser('admin', otherSchool);
    // A platform admin: role admin, no school of their own. This is the account
    // every seed actually creates, and the one GET /admin/orders used to refuse.
    platformAdmin = await createTestUser('admin', null);
    // A parent whose own school is the *other* one, so there is an order at
    // each school to tell a scoped queue from an unscoped one.
    otherSchoolParent = await createTestUser('parent', otherSchool);

    child = await createTestStudent(school, classId, 'Order Child');
    otherChild = await createTestStudent(otherSchool, otherClass, 'Other Child');
    await linkParent(parent.id, child);
    await linkParent(otherParent.id, otherChild);
    await linkParent(otherSchoolParent.id, otherChild);

    // A photo the parent may order: tagged with their own child, and ready.
    photoId = await createTestPhoto({
      schoolId: school,
      classId,
      uploadedBy: teacher.id,
      status: 'processing',
    });
    await tagStudent(photoId, child, teacher.id);
    await setPhotoReady(photoId);

    // A photo of somebody else's child, which they must not be able to order.
    otherPhotoId = await createTestPhoto({
      schoolId: otherSchool,
      classId: otherClass,
      uploadedBy: teacher.id,
      status: 'processing',
    });
    await tagStudent(otherPhotoId, otherChild, teacher.id);
    await setPhotoReady(otherPhotoId);
  }, 90_000);

  afterAll(cleanupUsers);

  const orderBody = (id: string = photoId, quantity = 2) => ({
    items: [{ photoId: id, productType: 'print_4x6', quantity }],
    shippingAddress: '1 Test Street, Testville',
  });

  async function placeOrder(user: TestUser = parent, body = orderBody()) {
    return request(app)
      .post('/api/v1/orders')
      .set(bearer(user.token))
      .set('X-Idempotency-Key', randomUUID())
      .send(body);
  }

  /**
   * Post a body verbatim, for the cases that are about the body's shape rather
   * than about ordering. `placeOrder` infers its parameter type from
   * `orderBody()`, so it cannot carry a field that body does not have — which
   * is precisely what the `notes` cases below need to send.
   */
  const postOrder = (body: Record<string, unknown>, user: TestUser = parent) =>
    request(app)
      .post('/api/v1/orders')
      .set(bearer(user.token))
      .set('X-Idempotency-Key', randomUUID())
      .send(body);

  // ── Creation ────────────────────────────────────────────────────────

  it('rejects an unauthenticated order', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('X-Idempotency-Key', randomUUID())
      .send(orderBody());
    expect(res.status).toBe(401);
  });

  it('rejects a teacher placing an order', async () => {
    const res = await placeOrder(teacher);
    expect(res.status).toBe(403);
  });

  it('requires an idempotency key', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(parent.token))
      .send(orderBody());
    expect(res.status).toBe(400);
  });

  /**
   * The client sends no price. If the server ever started trusting one, this
   * is the test that fails — the total is asserted against the server's own
   * catalogue, not against a number the request supplied.
   */
  it('prices the order server-side', async () => {
    const res = await placeOrder();

    expect(res.status).toBe(201);
    expect(res.body.data.total_cents).toBe(PRODUCT_PRICES_CENTS.print_4x6 * 2);
    expect(res.body.data.status).toBe('pending');
  }, 30_000);

  it('ignores a client-supplied price', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(parent.token))
      .set('X-Idempotency-Key', randomUUID())
      .send({
        items: [
          { photoId, productType: 'print_8x10', quantity: 1, unitPriceCents: 1 },
        ],
        shippingAddress: '1 Test Street',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.total_cents).toBe(PRODUCT_PRICES_CENTS.print_8x10);
  }, 30_000);

  it('replays the same response for a repeated idempotency key', async () => {
    const key = randomUUID();
    const send = () =>
      request(app)
        .post('/api/v1/orders')
        .set(bearer(parent.token))
        .set('X-Idempotency-Key', key)
        .send(orderBody());

    const first = await send();
    expect(first.status).toBe(201);

    const second = await send();
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
  }, 30_000);

  /**
   * The privacy boundary, applied to ordering: a parent may only buy prints of
   * photos their own child is tagged in.
   */
  it('rejects ordering a photo of somebody else\'s child', async () => {
    const res = await placeOrder(parent, orderBody(otherPhotoId));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('UNAUTHORIZED_PHOTOS');
  }, 30_000);

  it('rejects an unknown product type', async () => {
    const res = await placeOrder(parent, {
      items: [{ photoId, productType: '4x6', quantity: 1 }],
      shippingAddress: '1 Test Street',
    });
    expect(res.status).toBe(400);
  });

  it('rejects an empty item list', async () => {
    const res = await placeOrder(parent, {
      items: [],
      shippingAddress: '1 Test Street',
    });
    expect(res.status).toBe(400);
  });

  /**
   * Leaving the note blank is the ordinary path through checkout, and it was
   * the path that did not work: the sheet sends the optional field as `null`
   * and the schema accepted only `undefined`, so a normal order came back 400
   * "Validation failed" with nothing on screen to say which field was wrong.
   */
  it('accepts an order with the notes field omitted', async () => {
    const res = await postOrder({ ...orderBody() });

    expect(res.status).toBe(201);
    expect(res.body.data.notes).toBeNull();
  }, 30_000);

  /**
   * The same case as the client actually sends it. `notes` must stay
   * `.nullish()`; a regression to `.optional()` passes the test above and fails
   * this one, and a build already installed on a phone still sends null.
   */
  it('accepts an order whose notes are explicitly null', async () => {
    const res = await postOrder({ ...orderBody(), notes: null });

    expect(res.status).toBe(201);
    expect(res.body.data.notes).toBeNull();
  }, 30_000);

  it('keeps a note that was actually written', async () => {
    const res = await postOrder({ ...orderBody(), notes: 'Please gift wrap' });

    expect(res.status).toBe(201);
    expect(res.body.data.notes).toBe('Please gift wrap');
  }, 30_000);

  /**
   * The server requires an address and nothing checked before submitting, so a
   * blank one produced the same opaque 400 as the note did. Place Order is
   * disabled client-side now; the server must still refuse it.
   */
  it('rejects an empty shipping address', async () => {
    const res = await postOrder({
      items: [{ photoId, productType: 'print_4x6', quantity: 1 }],
      shippingAddress: '',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  /**
   * Tag ownership used to be the only check, so a photo the teacher had since
   * archived could still be bought from a feed the client had not refreshed.
   * That is permanent: `order_items.photo_id` is ON DELETE RESTRICT, so the
   * archived row can never be cleared afterwards.
   */
  it('refuses to order a photo that has been archived', async () => {
    const archived = await createTestPhoto({
      schoolId: school,
      classId,
      uploadedBy: teacher.id,
    });
    await tagStudent(archived, child, teacher.id);
    await setPhotoReady(archived);
    await supabaseTest.from('photos').update({ status: 'archived' }).eq('id', archived);

    const res = await placeOrder(parent, orderBody(archived));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PHOTO_UNAVAILABLE');
  }, 30_000);

  // The other half of the same guard: a photo whose upload never finished has
  // no processed object behind it, so an order for it could never be fulfilled.
  it('refuses to order a photo that is still processing', async () => {
    const unfinished = await createTestPhoto({
      schoolId: school,
      classId,
      uploadedBy: teacher.id,
      status: 'processing',
    });
    await tagStudent(unfinished, child, teacher.id);

    const res = await placeOrder(parent, orderBody(unfinished));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PHOTO_UNAVAILABLE');
  }, 30_000);

  // ── Idempotency ─────────────────────────────────────────────────────

  /**
   * The response interceptor cached whatever status the handler produced, for
   * 24 hours. `validate` runs downstream of it, so a 400 from the schema was
   * stored against the key and replayed on every retry — pinning the client to
   * its own first mistake even after it had corrected the payload, which is
   * exactly when a well-behaved client reuses the key.
   */
  it('does not replay a failure once the payload is corrected', async () => {
    const key = randomUUID();

    const rejected = await request(app)
      .post('/api/v1/orders')
      .set(bearer(parent.token))
      .set('X-Idempotency-Key', key)
      .send({ items: [], shippingAddress: '1 Test Street' });
    expect(rejected.status).toBe(400);

    const accepted = await request(app)
      .post('/api/v1/orders')
      .set(bearer(parent.token))
      .set('X-Idempotency-Key', key)
      .send(orderBody());

    // 400 here means the failure was cached; 409 DUPLICATE_REQUEST means the
    // lock outlived it. Both leave the client unable to retry for 24 hours.
    expect(accepted.status).toBe(201);
  }, 30_000);

  // ── Reading ─────────────────────────────────────────────────────────

  it('lists only the calling parent\'s own orders', async () => {
    const mine = await placeOrder();
    expect(mine.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/orders')
      .set(bearer(otherParent.token));

    expect(res.status).toBe(200);
    expect(res.body.data.some((o: { id: string }) => o.id === mine.body.data.id)).toBe(
      false,
    );
  }, 30_000);

  it('returns 404 rather than 403 for another parent\'s order', async () => {
    const mine = await placeOrder();

    const res = await request(app)
      .get(`/api/v1/orders/${mine.body.data.id}`)
      .set(bearer(otherParent.token));

    // 404, not 403: a 403 would confirm the ID exists.
    expect(res.status).toBe(404);
  }, 30_000);

  it('returns a signed thumbnail for each order item', async () => {
    const mine = await placeOrder();

    const res = await request(app)
      .get(`/api/v1/orders/${mine.body.data.id}`)
      .set(bearer(parent.token));

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items[0].thumbnailUrl).toContain('token=');
  }, 30_000);

  /**
   * The list endpoint selected the `orders` columns and nothing else, so every
   * order came back with `items` undefined and `OrderHistoryCard` rendered
   * `order.items?.length ?? 0` — every card in the history read "0 items",
   * including ones that really hold two. Two line items, so a fix that returns
   * a single item per order fails here too.
   */
  it('returns each order\'s items in the parent order history', async () => {
    const mine = await postOrder({
      items: [
        { photoId, productType: 'print_4x6', quantity: 1 },
        { photoId, productType: 'print_8x10', quantity: 1 },
      ],
      shippingAddress: '1 Test Street',
    });
    expect(mine.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/orders?limit=50')
      .set(bearer(parent.token));

    expect(res.status).toBe(200);
    const listed = res.body.data.find(
      (o: { id: string }) => o.id === mine.body.data.id,
    );
    expect(listed).toBeDefined();
    expect(listed.items).toHaveLength(2);
  }, 30_000);

  /**
   * All seven cursor decode sites caught only the JSON parse, so a cursor that
   * was valid JSON of the wrong shape — this one has no `id` — put the string
   * "undefined" into a PostgREST filter and came back as a 500 for what is
   * plainly a bad request.
   */
  it('rejects a cursor of the wrong shape with 400 rather than 500', async () => {
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: '2026-08-09T12:00:00.123456+00:00' }),
    ).toString('base64url');

    const res = await request(app)
      .get(`/api/v1/orders?cursor=${encodeURIComponent(cursor)}`)
      .set(bearer(parent.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CURSOR');
  });

  // ── Parent cancellation ─────────────────────────────────────────────

  it('lets a parent cancel their own pending order', async () => {
    const mine = await placeOrder();

    const res = await request(app)
      .patch(`/api/v1/orders/${mine.body.data.id}/cancel`)
      .set(bearer(parent.token));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  }, 30_000);

  it('rejects a parent cancelling somebody else\'s order', async () => {
    const mine = await placeOrder();

    const res = await request(app)
      .patch(`/api/v1/orders/${mine.body.data.id}/cancel`)
      .set(bearer(otherParent.token));

    expect(res.status).toBe(404);
  }, 30_000);

  it('rejects cancelling an order that is no longer pending', async () => {
    const mine = await placeOrder();
    const orderId = mine.body.data.id;

    await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set(bearer(admin.token))
      .send({ status: 'confirmed' });

    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/cancel`)
      .set(bearer(parent.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  }, 30_000);

  // ── Admin fulfilment ────────────────────────────────────────────────

  it('rejects a parent reading the admin order queue', async () => {
    const res = await request(app)
      .get('/api/v1/admin/orders')
      .set(bearer(parent.token));
    expect(res.status).toBe(403);
  });

  it('lists the school\'s orders for its admin', async () => {
    const mine = await placeOrder();

    const res = await request(app)
      .get('/api/v1/admin/orders')
      .set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.data.some((o: { id: string }) => o.id === mine.body.data.id)).toBe(
      true,
    );
  }, 30_000);

  /**
   * The same "0 items" defect as the parent history, on the screen where it
   * matters most: the fulfilment queue is what somebody works from to decide
   * what to print.
   */
  it('returns each order\'s items in the admin fulfilment queue', async () => {
    const mine = await postOrder({
      items: [
        { photoId, productType: 'print_4x6', quantity: 1 },
        { photoId, productType: 'print_5x7', quantity: 3 },
      ],
      shippingAddress: '1 Test Street',
    });
    expect(mine.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/admin/orders?limit=50')
      .set(bearer(admin.token));

    expect(res.status).toBe(200);
    const listed = res.body.data.find(
      (o: { id: string }) => o.id === mine.body.data.id,
    );
    expect(listed).toBeDefined();
    expect(listed.items).toHaveLength(2);
  }, 30_000);

  /**
   * A platform admin has no school of their own, and the endpoint answered 400
   * for exactly that caller — the only admin any seed creates. The console has
   * no school picker to supply `?schoolId`, so it rendered the 400 through its
   * empty state as "No orders yet": every order was unreachable and looked like
   * it did not exist.
   */
  it('shows a platform admin every school\'s orders', async () => {
    const here = await placeOrder();
    const elsewhere = await placeOrder(otherSchoolParent, orderBody(otherPhotoId));
    expect(here.status).toBe(201);
    expect(elsewhere.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/admin/orders?limit=50')
      .set(bearer(platformAdmin.token));

    expect(res.status).toBe(200);
    const ids = res.body.data.map((o: { id: string }) => o.id);
    expect(ids).toContain(here.body.data.id);
    expect(ids).toContain(elsewhere.body.data.id);
  }, 60_000);

  it('does not show an admin another school\'s orders', async () => {
    const mine = await placeOrder();

    const res = await request(app)
      .get('/api/v1/admin/orders')
      .set(bearer(otherAdmin.token));

    expect(res.status).toBe(200);
    expect(res.body.data.some((o: { id: string }) => o.id === mine.body.data.id)).toBe(
      false,
    );
  }, 30_000);

  it('rejects an admin advancing another school\'s order', async () => {
    const mine = await placeOrder();

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${mine.body.data.id}/status`)
      .set(bearer(otherAdmin.token))
      .send({ status: 'confirmed' });

    expect(res.status).toBe(403);
  }, 30_000);

  it('walks an order through the full fulfilment sequence', async () => {
    const mine = await placeOrder();
    const orderId = mine.body.data.id;

    for (const status of ['confirmed', 'processing', 'shipped', 'delivered']) {
      const res = await request(app)
        .patch(`/api/v1/admin/orders/${orderId}/status`)
        .set(bearer(admin.token))
        .send({ status });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
    }
  }, 60_000);

  /**
   * Statuses must move forwards only. Without the transition map an admin
   * could walk a delivered order back to processing, and the parent would be
   * notified that prints they already have are being made.
   */
  it('rejects moving a delivered order backwards', async () => {
    const mine = await placeOrder();
    const orderId = mine.body.data.id;

    for (const status of ['confirmed', 'processing', 'shipped', 'delivered']) {
      await request(app)
        .patch(`/api/v1/admin/orders/${orderId}/status`)
        .set(bearer(admin.token))
        .send({ status });
    }

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set(bearer(admin.token))
      .send({ status: 'processing' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  }, 60_000);

  it('rejects skipping a step in the sequence', async () => {
    const mine = await placeOrder();

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${mine.body.data.id}/status`)
      .set(bearer(admin.token))
      .send({ status: 'delivered' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  }, 30_000);

  it('rejects setting a status back to pending', async () => {
    const mine = await placeOrder();

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${mine.body.data.id}/status`)
      .set(bearer(admin.token))
      .send({ status: 'pending' });

    // 'pending' is not in the accepted enum at all — an order is born there
    // and nothing may put it back.
    expect(res.status).toBe(400);
  }, 30_000);

  /**
   * `order_status` has been in the notifications CHECK constraint since
   * migration 00010 with no producer. This is the test that it now has one.
   */
  it('notifies the parent when their order status changes', async () => {
    const mine = await placeOrder();
    const orderId = mine.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set(bearer(admin.token))
      .send({ status: 'confirmed' });
    expect(res.status).toBe(200);

    // The notification is fire-and-forget, so give it a moment to land.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const { data: notifications } = await supabaseTest
      .from('notifications')
      .select('type, data')
      .eq('user_id', parent.id)
      .eq('type', 'order_status');

    expect(
      notifications?.some(
        (n) => (n.data as { order_id?: string })?.order_id === orderId,
      ),
    ).toBe(true);
  }, 30_000);

  /**
   * `notifyAdminsOfNewOrder` used to filter `school_id = <school>` only, which
   * matched nobody: the only admin any seed creates is a platform admin with
   * school_id = null. This asserts a school-scoped admin does get told.
   */
  it('notifies the school admin that a new order arrived', async () => {
    const mine = await placeOrder();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const { data: notifications } = await supabaseTest
      .from('notifications')
      .select('type, data')
      .eq('user_id', admin.id)
      .eq('type', 'new_order');

    expect(
      notifications?.some(
        (n) => (n.data as { order_id?: string })?.order_id === mine.body.data.id,
      ),
    ).toBe(true);
  }, 30_000);

  it('rejects a malformed order id on cancel', async () => {
    const res = await request(app)
      .patch('/api/v1/orders/not-a-uuid/cancel')
      .set(bearer(parent.token));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
