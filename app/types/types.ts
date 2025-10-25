export type PostType = {
  id: number,
  title: string,
  content: string,
  creator: string,
  reservedSol: number,
  hypePrice: number,
  totalHype: number,
  userHypeBalance?: number
}

export type cahrtDataType = {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
}