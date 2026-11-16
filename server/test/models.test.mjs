import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const User = require('../src/modules/auth/user.model.js');
const Wedding = require('../src/modules/wedding/wedding.model.js');

const validWeddingFields = () => ({
  adminId: new mongoose.Types.ObjectId(),
  title: 'Rahul Weds Priya',
  partnerOneName: 'Rahul',
  partnerTwoName: 'Priya',
  weddingDate: '2027-02-15',
  timeZone: 'Asia/Kolkata',
  slug: 'rahul-weds-priya',
});

async function validationErrors(document) {
  try {
    await document.validate();
    return {};
  } catch (error) {
    return error.errors ?? {};
  }
}

describe('User schema', () => {
  it('requires name, email, role, and status', async () => {
    const errors = await validationErrors(new User());

    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['name', 'email', 'role', 'status']));
  });

  it('accepts only the documented role and status values', async () => {
    const invalidUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hash',
      role: 'GUEST',
      status: 'PENDING',
    });
    const errors = await validationErrors(invalidUser);

    expect(errors.role).toBeDefined();
    expect(errors.status).toBeDefined();
  });

  it('requires passwords for Admins and active Managers, but not invited or disabled Managers', async () => {
    const adminWithoutPassword = new User({
      name: 'Admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    const invitedManager = new User({
      name: 'Invited Manager',
      email: 'invited@example.com',
      role: 'MANAGER',
      status: 'INVITED',
    });
    const activeManagerWithoutPassword = new User({
      name: 'Active Manager',
      email: 'active@example.com',
      role: 'MANAGER',
      status: 'ACTIVE',
    });
    const disabledManager = new User({
      name: 'Disabled Manager',
      email: 'disabled@example.com',
      role: 'MANAGER',
      status: 'DISABLED',
    });
    const disabledManagerWithPassword = new User({
      name: 'Disabled Manager With Password',
      email: 'disabled-hash@example.com',
      passwordHash: 'existing-hash',
      role: 'MANAGER',
      status: 'DISABLED',
    });

    expect((await validationErrors(adminWithoutPassword)).passwordHash).toBeDefined();
    expect((await validationErrors(invitedManager)).passwordHash).toBeUndefined();
    expect((await validationErrors(activeManagerWithoutPassword)).passwordHash).toBeDefined();
    expect((await validationErrors(disabledManager)).passwordHash).toBeUndefined();
    expect((await validationErrors(disabledManagerWithPassword)).passwordHash).toBeUndefined();
    expect(disabledManagerWithPassword.passwordHash).toBe('existing-hash');
  });

  it('trims and lowercases email before validation and persistence', async () => {
    const user = new User({
      name: 'Test User',
      email: '  TEST.User@Example.COM  ',
      passwordHash: 'hash',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    expect(user.email).toBe('test.user@example.com');
    expect(await validationErrors(user)).toEqual({});
  });

  it('declares exactly the three approved indexes and string-only token partial filters', () => {
    expect(User.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ email: 1 }, { unique: true }],
        [
          { activationTokenHash: 1 },
          {
            unique: true,
            partialFilterExpression: { activationTokenHash: { $type: 'string' } },
          },
        ],
        [
          { passwordResetTokenHash: 1 },
          {
            unique: true,
            partialFilterExpression: { passwordResetTokenHash: { $type: 'string' } },
          },
        ],
      ]),
    );
    expect(User.schema.indexes()).toHaveLength(3);
  });
});

describe('Wedding schema', () => {
  it('requires the documented core wedding fields', async () => {
    const errors = await validationErrors(new Wedding());

    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining([
        'adminId',
        'title',
        'partnerOneName',
        'partnerTwoName',
        'weddingDate',
        'timeZone',
        'slug',
      ]),
    );
  });

  it('validates the wedding date format and IANA timezone', async () => {
    const wedding = new Wedding({
      ...validWeddingFields(),
      weddingDate: '15-02-2027',
      timeZone: 'Not/A_Timezone',
    });
    const errors = await validationErrors(wedding);

    expect(errors.weddingDate).toBeDefined();
    expect(errors.timeZone).toBeDefined();
  });

  it('defaults websitePublished to false and permits an unassigned Manager', async () => {
    const wedding = new Wedding(validWeddingFields());

    expect(wedding.websitePublished).toBe(false);
    expect(wedding.managerId).toBeUndefined();
    expect(await validationErrors(wedding)).toEqual({});

    const explicitlyUnassigned = new Wedding({ ...validWeddingFields(), managerId: null });
    expect((await validationErrors(explicitlyUnassigned)).managerId).toBeUndefined();
  });

  it('requires both cover image fields when coverImage exists', async () => {
    const missingCoverFields = new Wedding({ ...validWeddingFields(), coverImage: {} });
    const errors = await validationErrors(missingCoverFields);

    expect(errors['coverImage.url']).toBeDefined();
    expect(errors['coverImage.publicId']).toBeDefined();

    const validCover = new Wedding({
      ...validWeddingFields(),
      coverImage: { url: 'https://example.test/cover.jpg', publicId: 'cover-asset' },
    });
    expect(await validationErrors(validCover)).toEqual({});
    expect(validCover.coverImage._id).toBeUndefined();
  });

  it('keeps Our Story absent by default and applies nested defaults only when present', async () => {
    const withoutStory = new Wedding(validWeddingFields());
    expect(withoutStory.ourStory).toBeUndefined();

    const withStory = new Wedding({ ...validWeddingFields(), ourStory: {} });
    expect(withStory.ourStory.description).toBe('');
    expect(withStory.ourStory.images).toEqual([]);
    expect(withStory.ourStory._id).toBeUndefined();
    expect(await validationErrors(withStory)).toEqual({});
  });

  it('requires each Our Story image field and retains generated subdocument IDs', async () => {
    const incompleteStory = new Wedding({
      ...validWeddingFields(),
      ourStory: { images: [{ url: 'https://example.test/story.jpg', publicId: 'story-asset' }] },
    });
    expect((await validationErrors(incompleteStory))['ourStory.images.0.altText']).toBeDefined();

    const completeStory = new Wedding({
      ...validWeddingFields(),
      ourStory: {
        images: [{
          url: 'https://example.test/story.jpg',
          publicId: 'story-asset',
          altText: 'The couple together',
        }],
      },
    });
    expect(await validationErrors(completeStory)).toEqual({});
    expect(completeStory.ourStory.images[0]._id).toBeInstanceOf(mongoose.Types.ObjectId);
  });

  it('rejects more than two Our Story images', async () => {
    const wedding = new Wedding({
      ...validWeddingFields(),
      ourStory: {
        images: [1, 2, 3].map((number) => ({
          url: `https://example.test/story-${number}.jpg`,
          publicId: `story-asset-${number}`,
          altText: `Story image ${number}`,
        })),
      },
    });

    expect((await validationErrors(wedding))['ourStory.images']).toBeDefined();
  });

  it('declares exactly the approved indexes and keeps managerId non-unique', () => {
    const indexes = Wedding.schema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ adminId: 1 }, { unique: true }],
        [{ managerId: 1 }, {}],
        [{ slug: 1 }, { unique: true }],
      ]),
    );
    expect(indexes).toHaveLength(3);

    const managerIndex = indexes.find(([keys]) => keys.managerId === 1);
    expect(managerIndex[1].unique).not.toBe(true);
  });
});
