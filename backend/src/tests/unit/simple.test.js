describe('Simple Test', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have test environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.STRIPE_SECRET_KEY).toBe('sk_test_fake_key_for_testing');
  });

  it('should have global test utilities', () => {
    expect(global.testUtils).toBeDefined();
    expect(global.testUtils.createMockOrder).toBeInstanceOf(Function);
    expect(global.testUtils.createMockPaymentIntent).toBeInstanceOf(Function);
  });

  it('should create mock order', () => {
    const mockOrder = global.testUtils.createMockOrder();
    expect(mockOrder).toHaveProperty('id');
    expect(mockOrder).toHaveProperty('orderNumber');
    expect(mockOrder).toHaveProperty('userId');
    expect(mockOrder.items).toHaveLength(1);
  });

  it('should create mock payment intent', () => {
    const mockPaymentIntent = global.testUtils.createMockPaymentIntent();
    expect(mockPaymentIntent).toHaveProperty('id');
    expect(mockPaymentIntent).toHaveProperty('amount');
    expect(mockPaymentIntent).toHaveProperty('currency');
    expect(mockPaymentIntent).toHaveProperty('status');
  });
});
