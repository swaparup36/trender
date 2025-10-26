export type PostType = {
  id: number,
  title: string,
  content: string,
  creator: string,
  reservedSol: number,
  reservedHype: number,
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

export type tradeOrdersType = {
  userPubKey: string,
  postId: number,
  orderType: string,
  amount: number,
  price: number,
  totalCost: number,
  time: string,
}