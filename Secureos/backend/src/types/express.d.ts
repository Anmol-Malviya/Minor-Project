import { AuthContext } from "./auth";

declare global {
  namespace Express {
    interface Locals {
      auth?: AuthContext;
    }
  }
}

export {};

