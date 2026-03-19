import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Checkout from '../Checkout';

// 1. Mock Firebase so we don't make real network requests during the test
vi.mock('../../firebaseConfig', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(true),
  collection: vi.fn(),
  addDoc: vi.fn()
}));

describe('Checkout Component - Optimistic Order Flow', () => {
  it('processes mock payment and optimistically places an order instantly', async () => {
    // Spy functions to check if our callbacks fire correctly
    const mockOnOrderPlaced = vi.fn();
    const mockOnClearCart = vi.fn();

    // Mock a logged-in user with a valid, serviceable location
    const mockUser = {
      uid: 'test_user_123',
      name: 'Test User',
      phone: '9999999999',
      address: '123 Test St',
      area: 'Banjara Hills',
      location: 'Lat 17.4152, Lng 78.4358',
      locationAccuracy: 10,
    };

    // Mock cart and menu items
    const mockCart = { 'item_1': 1 }; // 1 item in cart
    const mockMenuItems = [
      { id: 'item_1', name: 'Test Juice', mrp: 150, offerPrice: 100, category: 'Signature Blends' as any }
    ];

    render(
      <Checkout
        user={mockUser}
        onBack={vi.fn()}
        cart={mockCart}
        menuItems={mockMenuItems}
        onClearCart={mockOnClearCart}
        onRemoveItem={vi.fn()}
        onIncrementItem={vi.fn()}
        onDecrementItem={vi.fn()}
        onOrderPlaced={mockOnOrderPlaced}
      />
    );

    // Step 1: Verify we are on the first screen and click "Proceed to Payment"
    expect(screen.getByText('Your Order.')).toBeInTheDocument();
    const proceedButton = screen.getByText('Proceed to Payment');
    fireEvent.click(proceedButton);

    // Step 2: Verify we are on the payment screen and click "Pay Now"
    await waitFor(() => expect(screen.getByText('Secure Payment')).toBeInTheDocument());
    const payNowButton = screen.getByText('Pay Now');
    fireEvent.click(payNowButton);

    // Step 3: Assert the optimistic UI updates happen instantly
    await waitFor(() => {
      // The success screen should render
      expect(screen.getByText('Order Successful')).toBeInTheDocument();
      // The cart should be cleared
      expect(mockOnClearCart).toHaveBeenCalled();
      // The order should be passed to App.tsx
      expect(mockOnOrderPlaced).toHaveBeenCalled();
    });

    // Step 4: Verify the generated order data is mathematically correct
    const generatedOrder = mockOnOrderPlaced.mock.calls[0][0];
    expect(generatedOrder.total).toBe(130); // 100 (item) + 30 (delivery fee since < 250)
    expect(generatedOrder.paymentStatus).toBe('paid');
    expect(generatedOrder.items[0].name).toBe('Test Juice');
  });
});