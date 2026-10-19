export class MarketError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}
