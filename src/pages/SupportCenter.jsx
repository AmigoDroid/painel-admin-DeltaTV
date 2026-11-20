import {api} from "../api.js";
import SupportCenter from "@deltatv/ui/SupportCenter";
export default function AdminSupportCenter(props) {
  return <SupportCenter {...props} api={api} />;
}
