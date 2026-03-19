import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminSetupRouter from "./adminSetup";
import accountsRouter from "./accounts";
import userRightsRouter from "./userRights";
import reportsRouter from "./reports";
import storeLayoutRouter from "./storeLayout";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminSetupRouter);
router.use("/accounts", accountsRouter);
router.use("/user-rights", userRightsRouter);
router.use("/reports", reportsRouter);
router.use("/store-layout", storeLayoutRouter);
router.use("/orders", ordersRouter);

export default router;
