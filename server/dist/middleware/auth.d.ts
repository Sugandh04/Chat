import type { Request, Response, NextFunction } from "express";
declare module "express-session" {
    interface SessionData {
        userId?: string;
    }
}
declare global {
    namespace Express {
        interface Request {
            currentUserId?: string;
            currentUserName?: string;
        }
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.d.ts.map