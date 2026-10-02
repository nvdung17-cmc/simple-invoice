/** Claims of the access token. `sub` is the id of the User. */
export interface JwtPayload {
  sub: string;
  email: string;
}
