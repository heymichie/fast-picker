import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminSetupRouter from "./adminSetup";
import accountsRouter from "./accounts";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminSetupRouter);
router.use("/accounts", accountsRouter);

export default router;
