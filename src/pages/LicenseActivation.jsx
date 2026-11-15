import DeviceLicenseActivation from "@deltatv/ui/DeviceLicenseActivation";
import { api } from "../api.js";
export default function LicenseActivation() {
  return <DeviceLicenseActivation role="admin" api={api}/>;
}
