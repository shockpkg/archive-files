all: test-archive-zip.zip \
	test-archive-7z.zip \
	test-archive-ditto.zip \
	test-archive-gtar.tar \
	test-archive-gtar.tar.gz \
	test-archive-gtar.tar.bz2 \
	test-archive-gtar.tar.xz \
	test-archive-hybrid.iso \
	test-archive-hfsp.dmg \
	test-archive-hfsp-j.dmg \
	test-archive-hfsp-c.dmg \
	test-archive-hfsp-j-c.dmg \
	test-archive-apfs.dmg \
	test-archive-apfs-c.dmg

test-archive:
	mkdir 'test-archive'
	#
	cat 'files/lorem.bin' > 'test-archive/lorem.dat'
	cat 'files/lorem.bin' > 'test-archive/lorem.bin'
	#
	mkdir 'test-archive/dir'
	cat 'files/lorem.bin' > 'test-archive/dir/lorem.bin'
	#
	mkdir 'test-archive/dir/sub'
	cat 'files/lorem.bin' > 'test-archive/dir/sub/lorem.bin'
	#
	cd 'test-archive'; ln -s 'lorem.bin' 'lorem-ln.bin'
	cd 'test-archive'; ln -s './lorem.bin' 'lorem-ln-dot-slash.bin'
	#
	cd 'test-archive'; ln -s 'dir' 'dir-ln'
	cd 'test-archive'; ln -s 'dir/' 'dir-ln-trail-slash'
	cd 'test-archive'; ln -s './dir' 'dir-ln-dot-slash'
	#
	printf 'data' > 'test-archive/file-norsrc.bin'
	#
	printf 'data' > 'test-archive/file-rsrc-empty.bin'
	printf '' > 'test-archive/file-rsrc-empty.bin/..namedfork/rsrc'
	#
	printf 'data' > 'test-archive/file-rsrc-content.bin'
	printf 'rsrc' > 'test-archive/file-rsrc-content.bin/..namedfork/rsrc'

test-archive-zip.zip: test-archive
	cd 'test-archive'; zip -r -y '../test-archive-zip.zip' *

test-archive-7z.zip: test-archive
	cd 'test-archive'; 7z a '../test-archive-7z.zip' *

test-archive-ditto.zip: test-archive
	ditto -ck --rsrc --sequesterRsrc 'test-archive' 'test-archive-ditto.zip'

test-archive-gtar.tar: test-archive
	cd 'test-archive'; gtar -c -f '../test-archive-gtar.tar' --owner=0 --group=0 *

test-archive-gtar.tar.gz: test-archive
	cd 'test-archive'; gtar -cz -f '../test-archive-gtar.tar.gz' --owner=0 --group=0 *

test-archive-gtar.tar.bz2: test-archive
	cd 'test-archive'; gtar -cj -f '../test-archive-gtar.tar.bz2' --owner=0 --group=0 *

test-archive-gtar.tar.xz: test-archive
	cd 'test-archive'; gtar -cj -f '../test-archive-gtar.tar.xz' --owner=0 --group=0 *

test-archive-hybrid.iso: test-archive
	hdiutil makehybrid \
		-iso \
		-joliet \
		-default-volume-name 'test-archive-hybrid' \
		-o 'test-archive-hybrid.iso' \
		'test-archive'

test-archive-hfsp.dmg: test-archive
	hdiutil create \
		-fs 'HFS+' \
		-volname 'test-archive-hfsp' \
		-srcfolder 'test-archive' \
		-format 'UDZO' \
		'test-archive-hfsp.dmg'

test-archive-hfsp-j.dmg: test-archive
	hdiutil create \
		-fs 'Journaled HFS+' \
		-volname 'test-archive-hfsp-j' \
		-srcfolder 'test-archive' \
		-format 'UDZO' \
		'test-archive-hfsp-j.dmg'

test-archive-hfsp-c.dmg: test-archive
	hdiutil create \
		-fs 'Case-sensitive HFS+' \
		-volname 'test-archive-hfsp-c' \
		-srcfolder 'test-archive' \
		-format 'UDZO' \
		'test-archive-hfsp-c.dmg'

test-archive-hfsp-j-c.dmg: test-archive
	hdiutil create \
		-fs 'Case-sensitive Journaled HFS+' \
		-volname 'test-archive-hfsp-j-c' \
		-srcfolder 'test-archive' \
		-format 'UDZO' \
		'test-archive-hfsp-j-c.dmg'

test-archive-apfs.dmg: test-archive
	hdiutil create \
		-fs 'APFS' \
		-volname 'test-archive-apfs' \
		-srcfolder 'test-archive' \
		-format 'UDZO' \
		'test-archive-apfs.dmg'

test-archive-apfs-c.dmg: test-archive
	hdiutil create \
		-fs 'Case-sensitive APFS' \
		-volname 'test-archive-apfs-c' \
		-srcfolder 'test-archive' \
		-format 'UDZO' \
		'test-archive-apfs-c.dmg'
