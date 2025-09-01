// A map where the key is the password and the value is a set of granted permissions.
const passwordPermissions = new Map<string, Set<string>>();

const parsePermissions = () => {
	const envVar = process.env.FEATURE_PASSWORDS;
	if (!envVar) {
		return;
	}

	// Format: "password_a:perm1,perm2;password_b:perm3,perm4"
	const entries = envVar.split(';').filter(Boolean);
	for (const entry of entries) {
		const parts = entry.split(':');
		if (parts.length !== 2) {
			console.warn(`[FeaturePasswords] Invalid entry format: "${entry}". Skipping.`);
			continue;
		}
		const password = parts[0].trim();
		const permissions = parts[1].split(',').map(p => p.trim()).filter(Boolean);
		if (password && permissions.length > 0) {
			passwordPermissions.set(password, new Set(permissions));
		}
	}
};

// Initialize the permissions map on startup.
parsePermissions();

const isExplicitlyDisabled = process.env.FEATURE_PASSWORD_ENABLED === 'false';

/**
 * Checks if the feature password system is active.
 * It is considered active if passwords are configured and it's not explicitly disabled via the FEATURE_PASSWORD_ENABLED environment variable.
 */
export const isFeaturePasswordRequired = !isExplicitlyDisabled && passwordPermissions.size > 0;

/**
 * Checks if a given password has the required permission.
 * Permissions can be specific (e.g., 'llm-gemini') or grant wider access (e.g., 'llm-all').
 * @param password The password provided by the user.
 * @param requiredPermission The permission needed to access a specific feature.
 * @returns `true` if access is granted, `false` otherwise.
 */
export const hasPermission = (password: string | undefined, requiredPermission: string): boolean => {
	if (!isFeaturePasswordRequired) {
		return true; // System is disabled, so all access is granted.
	}
	if (!password) {
		return false; // System is enabled, but no password was provided.
	}

	const grantedPermissions = passwordPermissions.get(password);
	if (!grantedPermissions) {
		return false; // The provided password is not in the list.
	}

	// The password grants the specific permission required.
	if (grantedPermissions.has(requiredPermission)) {
		return true;
	}

	// Check for wildcard/group permissions. e.g., 'llm-all' grants 'llm-gemini'.
	const permissionGroup = requiredPermission.split('-')[0]; // e.g., 'llm' from 'llm-gemini'
	if (grantedPermissions.has(`${permissionGroup}-all`)) {
		return true;
	}
	
	return false;
};
