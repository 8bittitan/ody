import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/hooks/useConfig';
import { useNotifications } from '@/hooks/useNotifications';
import { KeyRound, PlusIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

type AuthProvider = 'jira' | 'github';

type JiraProfile = {
  profile: string;
  email: string;
  apiToken: string;
};

type GitHubProfile = {
  profile: string;
  token: string;
};

type EditorState =
  | {
      open: false;
      provider: AuthProvider;
      initialProfile: null;
      profile: string;
      email: string;
      secret: string;
    }
  | {
      open: true;
      provider: AuthProvider;
      initialProfile: string | null;
      profile: string;
      email: string;
      secret: string;
    };

type DeleteState = {
  open: boolean;
  provider: AuthProvider;
  profile: string | null;
};

const EMPTY_EDITOR: EditorState = {
  open: false,
  provider: 'jira',
  initialProfile: null,
  profile: '',
  email: '',
  secret: '',
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJiraProfiles = (value: unknown): JiraProfile[] => {
  if (!isObject(value)) {
    return [];
  }

  const profiles: JiraProfile[] = [];

  for (const [profile, credentials] of Object.entries(value)) {
    if (!isObject(credentials)) {
      continue;
    }

    if (typeof credentials.email !== 'string' || typeof credentials.apiToken !== 'string') {
      continue;
    }

    profiles.push({
      profile,
      email: credentials.email,
      apiToken: credentials.apiToken,
    });
  }

  return profiles.sort((a, b) => a.profile.localeCompare(b.profile));
};

const parseGitHubProfiles = (value: unknown): GitHubProfile[] => {
  if (!isObject(value)) {
    return [];
  }

  const profiles: GitHubProfile[] = [];

  for (const [profile, credentials] of Object.entries(value)) {
    if (!isObject(credentials)) {
      continue;
    }

    if (typeof credentials.token !== 'string') {
      continue;
    }

    profiles.push({
      profile,
      token: credentials.token,
    });
  }

  return profiles.sort((a, b) => a.profile.localeCompare(b.profile));
};

const maskToken = (token: string) => {
  if (token.length <= 6) {
    return '******';
  }

  return `******${token.slice(-6)}`;
};

export const AuthPanel = () => {
  const [tab, setTab] = useState<AuthProvider>('jira');
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [pendingDelete, setPendingDelete] = useState<DeleteState>({
    open: false,
    provider: 'jira',
    profile: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { authStore, isLoading, loadAuth, saveJira, saveGitHub, removeJira, removeGitHub } =
    useAuth();
  const { config } = useConfig();
  const { success, error } = useNotifications();

  useEffect(() => {
    void loadAuth()
      .then(() => {
        setLoadError(null);
      })
      .catch((cause) => {
        setLoadError(cause instanceof Error ? cause.message : 'Unable to load credentials');
      });
  }, [loadAuth]);

  const jiraProfiles = useMemo(() => parseJiraProfiles(authStore?.jira), [authStore]);
  const githubProfiles = useMemo(() => parseGitHubProfiles(authStore?.github), [authStore]);
  const activeJiraProfile =
    isObject(config?.jira) && typeof config.jira.profile === 'string'
      ? config.jira.profile
      : 'default';
  const activeGitHubProfile =
    isObject(config?.github) && typeof config.github.profile === 'string'
      ? config.github.profile
      : 'default';
  const hasProfiles = jiraProfiles.length > 0 || githubProfiles.length > 0;

  const openAddDialog = (provider: AuthProvider) => {
    setEditor({
      open: true,
      provider,
      initialProfile: null,
      profile: '',
      email: '',
      secret: '',
    });
  };

  const openEditJiraDialog = (profile: JiraProfile) => {
    setEditor({
      open: true,
      provider: 'jira',
      initialProfile: profile.profile,
      profile: profile.profile,
      email: profile.email,
      secret: profile.apiToken,
    });
  };

  const openEditGitHubDialog = (profile: GitHubProfile) => {
    setEditor({
      open: true,
      provider: 'github',
      initialProfile: profile.profile,
      profile: profile.profile,
      email: '',
      secret: profile.token,
    });
  };

  const closeEditor = () => {
    setEditor(EMPTY_EDITOR);
  };

  const handleSave = async () => {
    if (!editor.open) {
      return;
    }

    const profileName = editor.profile.trim();
    if (profileName.length === 0) {
      error({ title: 'Profile name is required' });
      return;
    }

    setIsSaving(true);

    try {
      if (editor.provider === 'jira') {
        const email = editor.email.trim();
        const apiToken = editor.secret.trim();

        if (email.length === 0 || apiToken.length === 0) {
          error({ title: 'Jira email and API token are required' });
          return;
        }

        if (editor.initialProfile && editor.initialProfile !== profileName) {
          await removeJira(editor.initialProfile);
        }

        await saveJira(profileName, { email, apiToken });
      } else {
        const token = editor.secret.trim();

        if (token.length === 0) {
          error({ title: 'GitHub token is required' });
          return;
        }

        if (editor.initialProfile && editor.initialProfile !== profileName) {
          await removeGitHub(editor.initialProfile);
        }

        await saveGitHub(profileName, { token });
      }

      success({ title: 'Credentials saved', description: profileName });
      closeEditor();
    } catch {
      error({ title: 'Failed to save credentials' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete.profile) {
      return;
    }

    setIsDeleting(true);

    try {
      if (pendingDelete.provider === 'jira') {
        await removeJira(pendingDelete.profile);
      } else {
        await removeGitHub(pendingDelete.profile);
      }

      success({ title: 'Profile deleted', description: pendingDelete.profile });
      setPendingDelete({ open: false, provider: pendingDelete.provider, profile: null });
    } catch {
      error({ title: 'Failed to delete profile' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="border-edge bg-background/30 rounded-lg border">
        <LoadingSpinner size="lg" label="Loading auth profiles" />
      </section>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        icon={<KeyRound className="size-5" />}
        title="Auth profiles unavailable"
        description={loadError}
        actionLabel="Retry"
        onAction={() => {
          void loadAuth().catch(() => {
            return;
          });
        }}
      />
    );
  }

  if (!hasProfiles) {
    return (
      <EmptyState
        icon={<KeyRound className="size-5" />}
        title="No credentials configured"
        description="No credentials configured. Add a profile to enable imports."
        actionLabel="Add Profile"
        onAction={() => {
          openAddDialog(tab);
        }}
      />
    );
  }

  return (
    <section className="h-full overflow-y-auto pb-4">
      <div className="bg-panel/92 border-edge h-full rounded-lg border p-4 backdrop-blur-sm">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (value === 'jira' || value === 'github') {
              setTab(value);
            }
          }}
          className="h-full"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <TabsList className="bg-background/60 border-edge border">
              <TabsTrigger value="jira">Jira</TabsTrigger>
              <TabsTrigger value="github">GitHub</TabsTrigger>
            </TabsList>
            <Button size="sm" onClick={() => openAddDialog(tab)}>
              <PlusIcon /> Add Profile
            </Button>
          </div>

          <TabsContent value="jira" className="m-0">
            <div className="border-edge overflow-hidden rounded-lg border">
              <div className="bg-background/60 grid grid-cols-[1.2fr_1.6fr_auto] gap-3 border-b px-3 py-2 text-xs tracking-[0.08em] text-gray-400 uppercase">
                <span>Profile</span>
                <span>Email / Token</span>
                <span>Status</span>
              </div>
              {isLoading ? (
                <p className="text-mid px-3 py-3 text-sm">Loading Jira profiles...</p>
              ) : jiraProfiles.length === 0 ? (
                <p className="text-mid px-3 py-3 text-sm">No Jira profiles configured.</p>
              ) : (
                jiraProfiles.map((profile) => {
                  const isActive = profile.profile === activeJiraProfile;

                  return (
                    <div
                      key={profile.profile}
                      className="border-edge grid grid-cols-[1.2fr_1.6fr_auto] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                    >
                      <span className="text-light font-medium">{profile.profile}</span>
                      <div>
                        <p className="text-mid">{profile.email}</p>
                        <p className="text-light mt-1 font-mono text-xs">
                          {maskToken(profile.apiToken)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <Badge variant="outline" className="border-primary/35 text-primary">
                            active
                          </Badge>
                        )}
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openEditJiraDialog(profile)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          onClick={() => {
                            setPendingDelete({
                              open: true,
                              provider: 'jira',
                              profile: profile.profile,
                            });
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="github" className="m-0">
            <div className="border-edge overflow-hidden rounded-lg border">
              <div className="bg-background/60 grid grid-cols-[1.2fr_1.6fr_auto] gap-3 border-b px-3 py-2 text-xs tracking-[0.08em] text-gray-400 uppercase">
                <span>Profile</span>
                <span>Token Preview</span>
                <span>Status</span>
              </div>
              {isLoading ? (
                <p className="text-mid px-3 py-3 text-sm">Loading GitHub profiles...</p>
              ) : githubProfiles.length === 0 ? (
                <p className="text-mid px-3 py-3 text-sm">No GitHub profiles configured.</p>
              ) : (
                githubProfiles.map((profile) => {
                  const isActive = profile.profile === activeGitHubProfile;

                  return (
                    <div
                      key={profile.profile}
                      className="border-edge grid grid-cols-[1.2fr_1.6fr_auto] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                    >
                      <span className="text-light font-medium">{profile.profile}</span>
                      <span className="text-light font-mono text-xs">
                        {maskToken(profile.token)}
                      </span>
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <Badge variant="outline" className="border-primary/35 text-primary">
                            active
                          </Badge>
                        )}
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openEditGitHubDialog(profile)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          className="text-red"
                          onClick={() => {
                            setPendingDelete({
                              open: true,
                              provider: 'github',
                              profile: profile.profile,
                            });
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={editor.open} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="bg-panel border-edge max-w-md">
          <DialogHeader>
            <DialogTitle>{editor.initialProfile ? 'Edit profile' : 'Add profile'}</DialogTitle>
            <DialogDescription>
              {editor.provider === 'jira'
                ? 'Store Jira email and API token for imports.'
                : 'Store a GitHub personal access token for imports.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="space-y-1">
              <span className="text-light text-xs">Profile name</span>
              <Input
                value={editor.profile}
                onChange={(event) => {
                  setEditor((prev) => ({ ...prev, profile: event.target.value }));
                }}
              />
            </label>

            {editor.provider === 'jira' && (
              <label className="space-y-1">
                <span className="text-light text-xs">Email</span>
                <Input
                  type="email"
                  value={editor.email}
                  onChange={(event) => {
                    setEditor((prev) => ({ ...prev, email: event.target.value }));
                  }}
                />
              </label>
            )}

            <label className="space-y-1">
              <span className="text-light text-xs">
                {editor.provider === 'jira' ? 'API token' : 'Personal access token'}
              </span>
              <Input
                type="password"
                value={editor.secret}
                onChange={(event) => {
                  setEditor((prev) => ({ ...prev, secret: event.target.value }));
                }}
              />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleSave();
              }}
              disabled={isSaving}
            >
              Save Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete.open}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete((prev) => ({ ...prev, open: false, profile: null }));
          }
        }}
      >
        <DialogContent className="bg-panel border-edge max-w-md">
          <DialogHeader>
            <DialogTitle>Delete credential profile?</DialogTitle>
            <DialogDescription>
              {pendingDelete.profile
                ? `This removes ${pendingDelete.profile} from ${pendingDelete.provider}.`
                : 'This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingDelete((prev) => ({ ...prev, open: false, profile: null }));
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                void handleDelete();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
