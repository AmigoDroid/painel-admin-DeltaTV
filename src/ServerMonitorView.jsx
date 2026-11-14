import ServerMonitorView from "@deltatv/ui/ServerMonitorView";
import ServerHistoryModal from "./ServerHistoryModal.jsx";
import {api, getAuth} from "./api.js";
export default function AdminServerMonitorView({scope="admin"}) {
  return <ServerMonitorView scope={scope} api={api} canViewHistory={scope==="admin" && getAuth()?.user?.role==="superadmin"} HistoryModal={ServerHistoryModal}/>;
}
