import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string()
    .trim()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(30, 'El usuario no puede exceder los 30 caracteres')
    .regex(/^[a-zA-Z0-9_Ññ]+$/, 'El usuario solo puede contener letras, números y guión bajo'),
  password: z.string()
    .min(4, 'La contraseña debe tener al menos 4 caracteres')
    .max(200),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const firstError = Object.values(errors).flat()[0] || 'Datos inválidos';
      return res.status(400).json({ error: firstError });
    }
    req.body = result.data;
    next();
  };
}
