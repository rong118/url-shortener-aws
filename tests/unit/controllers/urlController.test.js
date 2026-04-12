jest.mock('../../../src/services/urlService');

const { shorten, stats } = require('../../../src/controllers/urlController');
const urlService = require('../../../src/services/urlService');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('shorten', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = mockRes();
    next = jest.fn();
  });

  it('returns 400 when url is missing', async () => {
    await shorten(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'url is required' });
  });

  it('returns 400 when url is not a string', async () => {
    req.body.url = 123;
    await shorten(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'url is required' });
  });

  it('returns 400 when url is invalid', async () => {
    req.body.url = 'not-a-url';
    await shorten(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid URL' });
  });

  it('returns 201 with short URL data on success', async () => {
    req.body.url = 'https://example.com/path';
    const fakeRow = {
      short_code: 'abc1234',
      expires_at: '2026-04-19T00:00:00Z',
      created_at: '2026-04-12T00:00:00Z',
    };
    urlService.createShortUrl.mockResolvedValue(fakeRow);

    await shorten(req, res, next);

    expect(urlService.createShortUrl).toHaveBeenCalledWith('https://example.com/path');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        short_code: 'abc1234',
        original_url: 'https://example.com/path',
      })
    );
  });

  it('calls next(err) when createShortUrl throws', async () => {
    req.body.url = 'https://example.com';
    const err = new Error('db error');
    urlService.createShortUrl.mockRejectedValue(err);

    await shorten(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('stats', () => {
  let req, res, next;

  beforeEach(() => {
    req = { params: { code: 'abc1234' } };
    res = mockRes();
    next = jest.fn();
  });

  it('returns 404 when the code does not exist', async () => {
    urlService.getStats.mockResolvedValue(null);
    await stats(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Short URL not found' });
  });

  it('returns stats data when the code exists', async () => {
    urlService.getStats.mockResolvedValue({
      short_code: 'abc1234',
      original_url: 'https://example.com',
      created_at: '2026-04-12T00:00:00Z',
      expires_at: '2026-04-19T00:00:00Z',
      click_count: 5,
      recent_clicks: [],
    });

    await stats(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        short_code: 'abc1234',
        click_count: 5,
      })
    );
  });

  it('calls next(err) when getStats throws', async () => {
    const err = new Error('db error');
    urlService.getStats.mockRejectedValue(err);

    await stats(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
