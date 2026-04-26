from django.urls import path

from . import api

app_name = "companion"

urlpatterns = [
    path("auth/csrf/",     api.csrf,        name="csrf"),
    path("auth/session/",  api.session,     name="session"),
    path("auth/signup/",   api.signup,      name="signup"),
    path("auth/login/",    api.login_view,  name="login"),
    path("auth/logout/",   api.logout_view, name="logout"),

    path("companion/hatch/",       api.hatch,       name="hatch"),
    path("companion/me/",          api.me,          name="me"),
    path("companion/certificate/", api.certificate, name="certificate"),
    path("companion/rename/",      api.rename,      name="rename"),

    path("verify/<str:unique_code>/", api.verify, name="verify"),
]
