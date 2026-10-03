# Importing every model here registers it on Base.metadata
from app.models.notification import Notification
from app.models.package import Package
from app.models.role import Permission, Role, role_permissions
from app.models.user import User

__all__ = ["Notification", "Package", "Permission", "Role", "User", "role_permissions"]
