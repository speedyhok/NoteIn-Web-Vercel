import { Plus } from 'lucide-react';
import React from 'react';
import type { GoogleUser, Folder, Notebook } from '../../types';
import {
  NoteinBrandLogo,
  NoteinFolderFill,
  NoteinFolder,
  NoteinDrawerRecent,
  NoteinFavorite,
  NoteinTrash,
  NoteinBooksVertical,
  NoteinDrawerHelp,
  NoteinInfo,
} from '../icons/NoteinIcons';

export type SidebarTab = 'categories' | 'folders' | 'tags';
export type DrawerSection = 'all' | 'recent' | 'favorites' | 'trash' | 'creative';

interface NoteinSidebarProps {
  folders?: Folder[];
  currentFolderId?: string | null;
  onSelectFolder?: (folderId: string | null) => void;
  onCreateFolderClick?: () => void;
  notebooks?: Notebook[];

  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  activeSection: DrawerSection;
  onSectionChange: (section: DrawerSection) => void;
  totalNotebooksCount: number;
  recentCount: number;
  favoritesCount: number;
  trashCount: number;
  googleUser: GoogleUser | null;
  onOpenDriveModal: () => void;
  onOpenHelpModal: () => void;
  onOpenAboutModal: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const NoteinSidebar: React.FC<NoteinSidebarProps> = ({
  folders = [],
  currentFolderId = null,
  onSelectFolder,
  onCreateFolderClick,
  notebooks = [],
  activeTab,
  onTabChange,
  activeSection,
  onSectionChange,
  totalNotebooksCount,
  recentCount,
  favoritesCount,
  trashCount,
  googleUser,
  onOpenDriveModal,
  onOpenHelpModal,
  onOpenAboutModal,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'all' as DrawerSection,
      label: 'All Documents',
      icon: NoteinFolder,
      count: totalNotebooksCount,
    },
    {
      id: 'recent' as DrawerSection,
      label: 'Recent',
      icon: NoteinDrawerRecent,
      count: recentCount,
    },
    {
      id: 'favorites' as DrawerSection,
      label: 'Favorites',
      icon: NoteinFavorite,
      count: favoritesCount,
    },
    {
      id: 'trash' as DrawerSection,
      label: 'Trash Bin',
      icon: NoteinTrash,
      count: trashCount,
    },
    {
      id: 'creative' as DrawerSection,
      label: 'Creative Library',
      icon: NoteinBooksVertical,
      count: undefined,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 998,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <aside
        className={`notein-sidebar ${isOpenMobile ? 'notein-sidebar-mobile-open' : ''}`}
        style={{
          width: '230px',
          minWidth: '230px',
          height: '100%',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          userSelect: 'none',
          zIndex: 999,
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top Header & Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 14px' }}>
          {/* Brand Logo & Version Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '4px 6px 16px 6px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(63, 82, 255, 0.2)',
              }}
            >
              <NoteinBrandLogo size={36} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                }}
              >
                NoteIn
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.01em',
                }}
              >
                v2.1.27.0 Global
              </div>
            </div>
          </div>

          {/* Segmented Control Switcher (Categories | Folders | Tags) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-tertiary)',
              padding: '3px',
              borderRadius: '9999px',
              marginBottom: '16px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {(['categories', 'folders', 'tags'] as SidebarTab[]).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    fontSize: '11px',
                    fontWeight: isActive ? 700 : 500,
                    textTransform: 'capitalize',
                    color: isActive ? '#3f52ff' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'var(--bg-primary)' : 'transparent',
                    borderRadius: '9999px',
                    border: 'none',
                    boxShadow: isActive ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Navigation Items (Switched based on activeTab) */}
          {activeTab === 'folders' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* All Documents / Desktop Root */}
              <button
                onClick={() => {
                  if (onSelectFolder) onSelectFolder(null);
                  if (onCloseMobile) onCloseMobile();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: currentFolderId === null ? 'rgba(63, 82, 255, 0.1)' : 'transparent',
                  color: currentFolderId === null ? '#3f52ff' : 'var(--text-secondary)',
                  fontWeight: currentFolderId === null ? 700 : 500,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <NoteinFolderFill size={18} color={currentFolderId === null ? '#3f52ff' : 'var(--text-muted)'} />
                  <span>Desktop (All)</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{totalNotebooksCount}</span>
              </button>

              {/* User Folders List */}
              {folders.map((f) => {
                const count = notebooks.filter((n) => n.folderId === f.id).length;
                const isSelected = currentFolderId === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      if (onSelectFolder) onSelectFolder(f.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'rgba(63, 82, 255, 0.1)' : 'transparent',
                      color: isSelected ? '#3f52ff' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '13px',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <NoteinFolderFill size={18} color={f.color || '#4E5262'} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {f.name}
                      </span>
                    </div>
                    {count > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '1px 7px',
                          borderRadius: '9999px',
                          backgroundColor: isSelected ? 'rgba(63, 82, 255, 0.18)' : 'var(--bg-tertiary)',
                          color: isSelected ? '#3f52ff' : 'var(--text-muted)',
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Add New Folder Button in Sidebar */}
              {onCreateFolderClick && (
                <button
                  onClick={onCreateFolderClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    border: '1px dashed var(--border-subtle)',
                    color: '#3f52ff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '6px',
                  }}
                >
                  <Plus size={14} color="#3f52ff" />
                  <span>New Folder</span>
                </button>
              )}
            </div>
          ) : (
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {navItems.map((item) => {
                const IconComp = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSectionChange(item.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      backgroundColor: isActive ? 'rgba(63, 82, 255, 0.1)' : 'transparent',
                      color: isActive ? '#3f52ff' : 'var(--text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '13px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease, color 0.15s ease',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <IconComp
                        size={18}
                        color={isActive ? '#3f52ff' : 'var(--text-muted)'}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.count !== undefined && item.count > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '1px 7px',
                          borderRadius: '9999px',
                          backgroundColor: isActive ? 'rgba(63, 82, 255, 0.18)' : 'var(--bg-tertiary)',
                          color: isActive ? '#3f52ff' : 'var(--text-muted)',
                        }}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Sub Navigation Divider */}
          <div
            style={{
              height: '1px',
              backgroundColor: 'var(--border-subtle)',
              margin: '14px 6px',
            }}
          />

          {/* Help & About */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <button
              onClick={onOpenHelpModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <NoteinDrawerHelp size={18} color="var(--text-muted)" />
              <span>Help &amp; Feedback</span>
            </button>

            <button
              onClick={onOpenAboutModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <NoteinInfo size={18} color="var(--text-muted)" />
              <span>About NoteIn</span>
            </button>
          </div>
        </div>

        {/* Bottom User Account / Cloud Sync Card */}
        <div style={{ padding: '14px' }}>
          <div
            onClick={onOpenDriveModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#3f52ff';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(63, 82, 255, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title="Google Account & Cloud Sync Settings"
          >
            {/* Avatar */}
            {googleUser?.picture ? (
              <img
                src={googleUser.picture}
                alt={googleUser.name}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#3f52ff',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                U
              </div>
            )}

            {/* Account Info */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {googleUser ? googleUser.name : 'Google Account'}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: googleUser ? '#16a34a' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: googleUser ? '#16a34a' : '#94a3b8',
                    display: 'inline-block',
                  }}
                />
                {googleUser ? 'Cloud Sync Active' : 'Connect Drive'}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
