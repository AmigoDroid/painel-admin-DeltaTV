import {createPanelUi} from "../shared/panel-ui.jsx";
import {api} from "./api.js";
export const {fmtDate, fmtDateTime, fmtAgo, fmtMoney, dateInput, spDateToIso, formatMac, accessStatus, Badge, PLATFORM_LABEL, OnlineBadge, PlatformBadge, DeliveryBadge, useUi, UiProvider, Modal, Field, Pager, Table, Empty, useList, useAction, useDebounced, SecretCode, PasswordInput, useLoad, LoadError, BrandMark, RowMenu, toCents} = createPanelUi(api);
