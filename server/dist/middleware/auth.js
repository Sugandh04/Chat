export function requireAuth(req, res, next) {
    if (!req.session.userId) {
        res.status(401).json({ message: "Please log in" });
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map