import SharedConfigureForm from '@deltatv/ui/ConfigureForm';
import {Field} from '../ui.jsx';
import {hasLicenseList} from './DeviceLists.jsx';
export {buildConfiguration} from '@deltatv/ui/ConfigureForm';
export default function ConfigureForm(props) {return <SharedConfigureForm {...props} Field={Field} hasLicenseList={hasLicenseList}/>;}
