// Registers every API module with the router (import order = registration order).
import "./auth";
import "./family";
import "./wellness";
import "./games";
import "./community";
import "./messages";
import "./billing";
import "./admin";
import "./blog";
import "./extras";
export { dispatch } from "../router";
