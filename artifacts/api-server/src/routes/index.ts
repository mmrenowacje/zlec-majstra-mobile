import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketplaceRouter from "./marketplace";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketplaceRouter);
router.use(storageRouter);

export default router;
