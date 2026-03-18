import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminSetupRouter from "./adminSetup";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminSetupRouter);

export default router;
