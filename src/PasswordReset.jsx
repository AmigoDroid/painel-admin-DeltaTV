import {ForgotPasswordView,ResetPasswordView} from '@deltatv/ui/PasswordResetView';
import {requestPasswordReset,completePasswordReset} from './api.js';
export const ForgotPassword = (props) => <ForgotPasswordView {...props} requestReset={requestPasswordReset} accountType="administrador" />;
export const ResetPassword = (props) => <ResetPasswordView {...props} completeReset={completePasswordReset} />;
