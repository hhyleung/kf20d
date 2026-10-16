// ============================================================
// #region TOASTS & DIALOGS
// Replacements for alert() / confirm() that don't block the page or
// pop native browser chrome over the kiosk view.
// ============================================================
const TOAST_DURATION_MS = { info: 2500, success: 2000, error: 5000 };

function showToast(message, type = "info") {
    let container = getElement("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.setAttribute("role", "status");
        container.setAttribute("aria-live", "polite");
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    const dismiss = () => {
        if (!toast.isConnected) return;
        toast.classList.add("toast-leaving");
        setTimeout(() => toast.remove(), 200);
    };
    toast.addEventListener("click", dismiss);
    setTimeout(dismiss, TOAST_DURATION_MS[type] ?? TOAST_DURATION_MS.info);
}

// Shows `message` with one button per choice ({ label, value, className }).
// Resolves to the chosen value, or null if dismissed (Cancel, Esc, backdrop).
function chooseDialog(message, choices) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "dialog-overlay";
        overlay.innerHTML = `
            <div class="dialog-box" role="alertdialog" aria-modal="true">
                <p class="dialog-message"></p>
                <div class="dialog-actions"></div>
            </div>`;
        selectElement(".dialog-message", overlay).textContent = message;
        const actions = selectElement(".dialog-actions", overlay);

        const previousFocus = document.activeElement;
        const close = (value) => {
            document.removeEventListener("keydown", onKey, true);
            overlay.remove();
            previousFocus?.focus?.();
            resolve(value);
        };
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close(null);
            }
        };

        [
            ...choices,
            { label: "Cancel", value: null, className: "btn-grey" },
        ].forEach((choice) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = choice.className || "btn-grey";
            btn.textContent = choice.label;
            btn.addEventListener("click", () => close(choice.value));
            actions.appendChild(btn);
        });

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) close(null);
        });
        document.addEventListener("keydown", onKey, true);
        document.body.appendChild(overlay);
        // Focus Cancel so a stray Enter never confirms a destructive action.
        actions.lastElementChild.focus();
    });
}

async function confirmDialog(
    message,
    { confirmText = "OK", danger = false } = {},
) {
    const result = await chooseDialog(message, [
        {
            label: confirmText,
            value: true,
            className: danger ? "btn-red" : "btn-blue",
        },
    ]);
    return result === true;
}

// Disables `button` while `fn` runs so slow saves can't be double-submitted.
async function withBusy(button, fn) {
    if (!button) return fn();
    if (button.disabled) return undefined;
    button.disabled = true;
    button.classList.add("is-busy");
    try {
        return await fn();
    } finally {
        button.disabled = false;
        button.classList.remove("is-busy");
    }
}
// ============================================================
// #endregion
// ============================================================
