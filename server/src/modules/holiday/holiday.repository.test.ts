import { describe, it, expect, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { holidayRepository } from './holiday.repository.js';
import { holidays } from '../../db/schema/index.js';
import { db } from '../../config/drizzle.js';

const ids: string[] = [];
afterAll(async () => {
  if (ids.length) await db.delete(holidays).where(inArray(holidays.id, ids));
});

describe('HolidayRepository (Postgres)', () => {
  it('creates and lists active holidays for a year, sorted by date', async () => {
    const a = await holidayRepository.queries.create({ name: 'HT Republic', date: new Date('2031-01-26'), type: 'NATIONAL' });
    const b = await holidayRepository.queries.create({ name: 'HT Independence', date: new Date('2031-08-15'), type: 'NATIONAL' });
    ids.push(a.id, b.id);

    const list = await holidayRepository.queries.listByYear(2031);
    const mine = list.filter((h) => ids.includes(h.id));
    expect(mine.map((h) => h.id)).toEqual([a.id, b.id]); // date ascending
  });

  it('excludes other years when a year is given', async () => {
    const h = await holidayRepository.queries.create({ name: 'HT 2032', date: new Date('2032-05-01') });
    ids.push(h.id);
    const list = await holidayRepository.queries.listByYear(2031);
    expect(list.some((x) => x.id === h.id)).toBe(false);
  });

  it('deletes by id', async () => {
    const h = await holidayRepository.queries.create({ name: 'HT Del', date: new Date('2031-12-25') });
    const del = await holidayRepository.queries.deleteById(h.id);
    expect(del?.id).toBe(h.id);
  });
});
