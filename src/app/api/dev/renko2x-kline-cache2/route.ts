import { createFastKlineCache2Handlers } from "@/app/lib/fastKlineCache2DevRoute";

export const dynamic = "force-dynamic";

export const { GET, POST } = createFastKlineCache2Handlers("renko2x");
