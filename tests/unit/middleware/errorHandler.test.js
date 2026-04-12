const errorHandler = require('../../../src/middleware/errorHandler');

describe('errorHandler', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('responds with 500 and a generic error message', () => {
    const err = new Error('boom');
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('logs the error', () => {
    const err = new Error('boom');
    errorHandler(err, req, res, next);
    expect(console.error).toHaveBeenCalledWith(err);
  });

  it('does not call next()', () => {
    errorHandler(new Error(), req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});
