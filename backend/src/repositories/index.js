const UserRepository = require('./UserRepository');
const OrderRepository = require('./OrderRepository');

// Create singleton instances
const userRepository = new UserRepository();
const orderRepository = new OrderRepository();

module.exports = {
  userRepository,
  orderRepository,
  UserRepository,
  OrderRepository
};
