from django.urls import path

from . import api

app_name = "companion"

urlpatterns = [
    # Auth
    path("auth/csrf/",       api.csrf,         name="csrf"),
    path("auth/session/",    api.session,      name="session"),
    path("auth/signup/",     api.signup,       name="signup"),
    path("auth/login/",      api.login_view,   name="login"),
    path("auth/logout/",     api.logout_view,  name="logout"),
    path("auth/logout-all/", api.logout_all,   name="logout_all"),
    path("account/export/",  api.export_data,  name="export_data"),
    path("account/delete/",  api.delete_account, name="delete_account"),
    path("founders/",        api.founder_status, name="founder_status"),

    # Companion lifecycle
    path("companion/hatch/",       api.hatch,       name="hatch"),
    path("companion/me/",          api.me,          name="me"),
    path("companion/certificate/", api.certificate, name="certificate"),
    path("companion/rename/",      api.rename,      name="rename"),
    path("companion/memories/",    api.memories,    name="memories"),

    # Actions
    path("companion/feed/",   api.feed,   name="feed"),
    path("companion/play/",   api.play,   name="play"),
    path("companion/sleep/",  api.sleep,  name="sleep"),
    path("companion/pet/",    api.pet,    name="pet"),
    path("companion/wash/",   api.wash,   name="wash"),
    path("companion/heal/",   api.heal,   name="heal"),
    path("companion/revive/", api.revive, name="revive"),
    path("companion/toilet/", api.toilet, name="toilet"),
    path("companion/wake/",   api.wake,   name="wake"),
    path("companion/scold/",  api.scold,  name="scold"),

    # AI Mind
    path("companion/chat/",   api.chat,   name="chat"),

    # Public
    path("verify/<str:unique_code>/", api.verify, name="verify"),
]
