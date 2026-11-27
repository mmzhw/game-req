<script setup lang="ts">
import { ref } from 'vue'
import type { ScrollbarInstance } from 'element-plus'

const scrollbar = ref<ScrollbarInstance>()

function resetScroll() {
    scrollbar.value?.scrollTo(0, 0)
}
</script>

<template>
    <el-dialog class="scroll-dialog" modal-class="scroll-dialog-overlay" @open="resetScroll">
        <el-scrollbar ref="scrollbar" class="scroll-dialog-content" :tabindex="0">
            <slot />
        </el-scrollbar>
        <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    </el-dialog>
</template>

<style>
.scroll-dialog-overlay > .el-overlay-dialog {
    overflow: hidden;
}

.el-dialog.scroll-dialog {
    --scroll-dialog-top: min(var(--el-dialog-margin-top, 15vh), 64px);
    --scroll-dialog-bottom: 16px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - var(--scroll-dialog-top) - var(--scroll-dialog-bottom));
    max-height: calc(100dvh - var(--scroll-dialog-top) - var(--scroll-dialog-bottom));
    margin-block: var(--scroll-dialog-top) var(--scroll-dialog-bottom);
}

.scroll-dialog > :is(.el-dialog__header, .el-dialog__footer) {
    flex: none;
}

.scroll-dialog > .el-dialog__body,
.scroll-dialog-content {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: auto;
}

.scroll-dialog-content > .el-scrollbar__wrap {
    min-height: 0;
    height: auto;
    overscroll-behavior: contain;
}

.scroll-dialog-content > .el-scrollbar__wrap:focus-visible {
    outline-offset: -2px;
}

.scroll-dialog-content > .el-scrollbar__wrap > .el-scrollbar__view {
    padding: 2px 8px 2px 2px;
}

@media (max-width: 780px), (max-height: 480px) {
    .el-dialog.scroll-dialog {
        --scroll-dialog-top: 12px;
        --scroll-dialog-bottom: 12px;
    }
}
</style>
