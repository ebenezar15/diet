import { z } from 'zod';

const nonNeg = z.number().finite().min(0);

export const ingredientSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(2),
  nameTa: z.string().optional(),
  nameHi: z.string().optional(),
  category: z.enum([
    'meat', 'fish', 'egg', 'dairy', 'veg', 'fruit', 'grain', 'pulse', 'nut', 'spice', 'herb', 'oil', 'condiment', 'protein'
  ]),
  n: z.tuple([
    nonNeg, nonNeg, nonNeg, nonNeg, nonNeg, nonNeg, nonNeg, nonNeg, nonNeg, nonNeg, nonNeg, nonNeg, nonNeg, nonNeg, nonNeg
  ]),
  fodmap: z.object({
    level: z.enum(['low', 'moderate', 'high']),
    groups: z.array(z.enum(['fructans', 'GOS', 'lactose', 'fructose', 'polyols'])),
    safeG: nonNeg.optional(),
    note: z.string().optional()
  }),
  swap: z.object({ to: z.string(), ratio: z.number().positive(), note: z.string().optional() }).optional(),
  units: z
    .object({
      tsp: nonNeg.optional(),
      tbsp: nonNeg.optional(),
      cup: nonNeg.optional(),
      piece: nonNeg.optional(),
      pieceName: z.string().optional()
    })
    .optional(),
  purchase: z.object({
    unit: z.enum(['kg', 'dozen', 'bunch', 'piece', 'packet', 'litre', 'tray']),
    roundG: z.number().positive().optional(),
    packG: z.number().positive().optional(),
    label: z.string().optional()
  }),
  section: z.enum(['meat-fish', 'vegetables', 'dairy-eggs', 'grocery']),
  shelfDays: z.number().int().positive(),
  pricePerKg: nonNeg,
  source: z.enum(['IFCT2017', 'USDA', 'Label'])
});

export const recipeSeedSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  localName: z.string().optional(),
  cuisine: z.enum([
    'Chettinad', 'Tamil Nadu', 'Kerala', 'Andhra', 'Hyderabadi', 'Karnataka', 'Goan', 'Bengali', 'Punjabi', 'Mughlai',
    'Indo-Chinese', 'Pan-Indian'
  ]),
  mealTypes: z.array(z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'side'])).min(1),
  protein: z.enum(['chicken', 'mutton', 'fish', 'prawns', 'crab', 'egg', 'paneer', 'veg']),
  servings: z.number().int().min(1).max(12),
  prepMin: z.number().int().min(0),
  cookMin: z.number().int().min(0),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  equipment: z
    .array(z.enum(['air-fryer', 'pressure-cooker', 'kadai', 'tawa', 'pan', 'oven', 'steamer', 'grill', 'blender', 'pot']))
    .min(1),
  spice: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  ingredients: z.array(z.object({ i: z.string(), g: z.number().positive(), note: z.string().optional() })).min(2),
  steps: z.array(z.object({ text: z.string().min(5), timerMin: z.number().positive().optional() })).min(2),
  tips: z.array(z.string()).optional(),
  makeAhead: z.string().optional(),
  batchFriendly: z.boolean().optional(),
  course: z.enum(['drink', 'dessert']).optional()
});

export const recipeFileSchema = z.object({ recipes: z.array(recipeSeedSchema) });

export const exerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['cardio', 'strength', 'mobility', 'ibs-relief']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  equipment: z.enum(['none', 'dumbbells', 'resistance-band', 'chair', 'mat']),
  muscles: z.array(z.string()),
  met: z.number().positive(),
  cues: z.array(z.string()).min(1),
  sets: z.number().int().optional(),
  reps: z.string().optional(),
  durationMin: z.number().optional(),
  ibsNote: z.string().optional()
});
