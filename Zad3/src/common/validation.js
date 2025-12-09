const Joi = require('joi');

const idParamSchema = Joi.number().integer().positive().required();

const productCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().min(1).required(),
  unit_price: Joi.number().precision(2).greater(0).required(),
  unit_weight: Joi.number().precision(3).greater(0).required(),
  category_id: Joi.number().integer().positive().required(),
});

const productUpdateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255),
  description: Joi.string().trim().min(1),
  unit_price: Joi.number().precision(2).greater(0),
  unit_weight: Joi.number().precision(3).greater(0),
  category_id: Joi.number().integer().positive(),
}).min(1);

const orderItemSchema = Joi.object({
  product_id: Joi.number().integer().positive().required(),
  quantity: Joi.number().integer().positive().required(),
  vat: Joi.number().precision(2).min(0).max(100).optional(),
  discount: Joi.number().precision(2).min(0).max(100).optional(),
});

const orderCreateSchema = Joi.object({
  user_name: Joi.string().trim().min(1).max(255).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^[0-9+\- ]+$/).required(),
  approved_at: Joi.date().optional().allow(null),
  items: Joi.array().items(orderItemSchema).min(1).required(),
});

const orderStatusUpdateSchema = Joi.object({
  status_id: Joi.number().integer().positive().required(),
});

module.exports = {
  idParamSchema,
  productCreateSchema,
  productUpdateSchema,
  orderCreateSchema,
  orderStatusUpdateSchema,
};
