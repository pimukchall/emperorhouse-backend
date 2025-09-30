import { z } from "zod";

export const IdParam = z.object({
  id: z.coerce.number().int().positive(),
});
