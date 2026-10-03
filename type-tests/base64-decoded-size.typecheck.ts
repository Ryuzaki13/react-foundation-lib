import { getBase64DecodedSize } from "../src/binary";

const getSize: (value: string) => number | null = getBase64DecodedSize;
const standardBase64 = "AA==" as const;
const decodedSize: number | null = getSize(standardBase64);
void [getSize, decodedSize];
