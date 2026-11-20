import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { User } from "./models.js";

const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || "";
if (!secret) throw new Error("JWT_SECRET (or SESSION_SECRET) is required");

export const signToken = (id: string) => jwt.sign({ sub: id }, secret, { expiresIn: "30d" });

export const verifyToken = (token: string): string | null => {
  try {
    return (jwt.verify(token, secret) as { sub: string }).sub;
  } catch {
    return null;
  }
};

export interface AuthedRequest extends Request {
  userId: string;
  role: "admin" | "member";
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const id = header.startsWith("Bearer ") ? verifyToken(header.slice(7)) : null;
  if (!id) return void res.status(401).json({ error: "Not signed in" });
  const user = await User.findById(id).select("role");
  if (!user) return void res.status(401).json({ error: "Not signed in" });
  (req as AuthedRequest).userId = id;
  (req as AuthedRequest).role = user.role as "admin" | "member";
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as AuthedRequest).role !== "admin") return void res.status(403).json({ error: "Admin only" });
  next();
}
