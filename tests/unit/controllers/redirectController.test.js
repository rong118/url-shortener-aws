jest.mock('../../../src/services/urlService');

const { redirect } = require('../../../src/controllers/redirectController');
const urlService = require('../../../src/services/urlService');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn();
  return res;
}

function mockReq(code = 'abc1234') {
  return {
    params: { code },
    ip: '127.0.0.1',
    get: jest.fn((header) => {
      if (header === 'user-agent') return 'TestAgent/1.0';
      if (header === 'referer') return null;
      return null;
    }),
  };
}

describe('redirect', () => {
  let res, next;

  beforeEach(() => {
    res = mockRes();
    next = jest.fn();
    urlService.trackClick.mockResolvedValue();
  });

  it('returns 404 when the code is not found', async () => {
    urlService.resolveShortCode.mockResolvedValue(null);

    await redirect(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Short URL not found or expired' });
  });

  it('redirects 302 to the original URL when found', async () => {
    urlService.resolveShortCode.mockResolvedValue({
      originalUrl: 'https://example.com/original',
      urlId: 42,
    });

    await redirect(mockReq(), res, next);

    expect(res.redirect).toHaveBeenCalledWith(302, 'https://example.com/original');
  });

  it('fires trackClick after redirecting', async () => {
    urlService.resolveShortCode.mockResolvedValue({
      originalUrl: 'https://example.com/original',
      urlId: 42,
    });

    await redirect(mockReq('abc1234'), res, next);

    expect(urlService.trackClick).toHaveBeenCalledWith(42, {
      ip: '127.0.0.1',
      userAgent: 'TestAgent/1.0',
      referrer: null,
    });
  });

  it('calls next(err) when resolveShortCode throws', async () => {
    const err = new Error('redis error');
    urlService.resolveShortCode.mockRejectedValue(err);

    await redirect(mockReq(), res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
